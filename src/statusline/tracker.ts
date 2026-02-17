/**
 * Statusline token tracker with SQLite backend
 * Thread-safe via SQLite WAL mode and transactions
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { TokenUsage, SessionTotals, ProviderModelUsage } from './types.js';

export class StatuslineTracker {
  private db: Database;
  private _sessionId: string;
  private currentWeek: string;

  constructor(sessionId: string) {
    // Get data directory
    const dataDir = join(process.env.HOME || '~', '.claude-code-proxy', 'data');
    mkdirSync(dataDir, { recursive: true });

    const dbPath = join(dataDir, 'statusline.db');
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent performance
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA busy_timeout = 5000'); // Wait up to 5s for locks

    this._sessionId = sessionId;
    this.currentWeek = this.getCurrentWeek();

    this.initializeSchema();
    this.checkWeekReset();
  }

  /**
   * Get current session ID
   */
  get sessionId(): string {
    return this._sessionId;
  }

  /**
   * Set session ID (for reusing tracker across different sessions)
   */
  set sessionId(value: string) {
    this._sessionId = value;
  }

  private getCurrentWeek(): string {
    const result = this.db.query<{ week: string }, []>(
      "SELECT strftime('%Y_W%W', 'now') as week"
    ).get();
    return result!.week;
  }

  private initializeSchema(): void {
    // Session costs table (per-session, reset on context clear)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        provider_model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        request_count INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL,
        UNIQUE(session_id, provider_model)
      )
    `);

    // Weekly costs table (aggregated, with week boundary)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS weekly_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_key TEXT NOT NULL,
        provider_model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        request_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        UNIQUE(week_key, provider_model)
      )
    `);

    // Metadata table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Tool usage table (per-session)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tool_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL,
        UNIQUE(session_id, tool_name)
      )
    `);

    // Create indexes
    this.db.run('CREATE INDEX IF NOT EXISTS idx_session_costs_session ON session_costs(session_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_weekly_costs_week ON weekly_costs(week_key)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_tool_usage_session ON tool_usage(session_id)');
  }

  private checkWeekReset(): void {
    const tx = this.db.transaction(() => {
      const meta = this.db.query<{ value: string }, [string]>(
        'SELECT value FROM metadata WHERE key = ?'
      ).get('current_week');

      const storedWeek = meta?.value;

      if (storedWeek && storedWeek !== this.currentWeek) {
        // Week changed - update metadata
        this.db.run(
          'INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))',
          ['current_week', this.currentWeek]
        );
        console.log(`📅 Week changed: ${storedWeek} → ${this.currentWeek}`);
      } else if (!storedWeek) {
        // First run
        this.db.run(
          'INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))',
          ['current_week', this.currentWeek]
        );
      }
    });

    tx();
  }

  /**
   * Record token usage - THREAD SAFE via SQLite transactions
   */
  recordUsage(providerModel: string, usage: TokenUsage): void {
    const tx = this.db.transaction(() => {
      const now = new Date().toISOString();

      // Update session costs (upsert)
      this.db.run(`
        INSERT INTO session_costs
          (session_id, provider_model, input_tokens, output_tokens,
           cache_read_tokens, cache_write_tokens, request_count, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(session_id, provider_model) DO UPDATE SET
          input_tokens = input_tokens + excluded.input_tokens,
          output_tokens = output_tokens + excluded.output_tokens,
          cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
          cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
          request_count = request_count + 1,
          last_updated = excluded.last_updated
      `, [
        this._sessionId,
        providerModel,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheReadTokens,
        usage.cacheWriteTokens,
        now
      ]);

      // Update weekly costs (upsert)
      this.db.run(`
        INSERT INTO weekly_costs
          (week_key, provider_model, input_tokens, output_tokens,
           cache_read_tokens, cache_write_tokens, request_count, created_at, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(week_key, provider_model) DO UPDATE SET
          input_tokens = input_tokens + excluded.input_tokens,
          output_tokens = output_tokens + excluded.output_tokens,
          cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
          cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
          request_count = request_count + 1,
          last_updated = excluded.last_updated
      `, [
        this.currentWeek,
        providerModel,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheReadTokens,
        usage.cacheWriteTokens,
        now,
        now
      ]);
    });

    tx();
  }

  /**
   * Get current session totals
   */
  getSessionTotals(): SessionTotals {
    const result = this.db.query<{
      input: number;
      output: number;
      cache_read: number;
      cache_write: number;
    }, [string]>(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output,
        COALESCE(SUM(cache_read_tokens), 0) as cache_read,
        COALESCE(SUM(cache_write_tokens), 0) as cache_write
      FROM session_costs
      WHERE session_id = ?
    `).get(this._sessionId);

    return {
      inputTokens: result?.input ?? 0,
      outputTokens: result?.output ?? 0,
      cacheReadTokens: result?.cache_read ?? 0,
      cacheWriteTokens: result?.cache_write ?? 0,
      totalTokens: (result?.input ?? 0) + (result?.output ?? 0) +
                   (result?.cache_read ?? 0) + (result?.cache_write ?? 0)
    };
  }

  /**
   * Format session totals for display
   */
  formatSessionTotals(): string {
    const totals = this.getSessionTotals();

    if (totals.totalTokens === 0) {
      return '0 tokens';
    }

    const formatK = (n: number): string => {
      if (n >= 1000) {
        return `${Math.round(n / 1000)}k`;
      }
      return String(n);
    };

    return `${formatK(totals.totalTokens)} tokens`;
  }

  /**
   * Get weekly usage by provider+model
   */
  getWeeklyUsage(): ProviderModelUsage[] {
    return this.db.query<ProviderModelUsage, [string]>(`
      SELECT
        provider_model as providerModel,
        input_tokens as inputTokens,
        output_tokens as outputTokens,
        cache_read_tokens as cacheReadTokens,
        cache_write_tokens as cacheWriteTokens,
        request_count as requestCount
      FROM weekly_costs
      WHERE week_key = ?
      ORDER BY provider_model
    `).all(this.currentWeek);
  }

  /**
   * Reset session costs (called when context is cleared)
   */
  resetSession(): void {
    this.db.run(
      'DELETE FROM session_costs WHERE session_id = ?',
      [this._sessionId]
    );
  }

  /**
   * Cleanup old sessions (garbage collection)
   */
  cleanupOldSessions(retentionHours: number = 24): number {
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();
    const result = this.db.run(
      'DELETE FROM session_costs WHERE last_updated < ?',
      [cutoff]
    );
    return result.changes;
  }

  /**
   * Get session ID for the last provider+model used
   * (for determining which provider to show in statusline)
   */
  getLastProviderModel(): string | null {
    const result = this.db.query<{ provider_model: string }, [string]>(`
      SELECT provider_model
      FROM session_costs
      WHERE session_id = ?
      ORDER BY last_updated DESC
      LIMIT 1
    `).get(this._sessionId);

    return result?.provider_model ?? null;
  }

  /**
   * Record tool usage - increment count for a specific tool
   */
  recordToolUsage(toolName: string): void {
    const now = new Date().toISOString();

    this.db.run(`
      INSERT INTO tool_usage (session_id, tool_name, count, last_updated)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(session_id, tool_name) DO UPDATE SET
        count = count + 1,
        last_updated = excluded.last_updated
    `, [this._sessionId, toolName, now]);
  }

  /**
   * Get tool usage counts for current session
   */
  getToolUsage(): Record<string, number> {
    const results = this.db.query<{ tool_name: string; count: number }, [string]>(`
      SELECT tool_name, count
      FROM tool_usage
      WHERE session_id = ?
      ORDER BY count DESC
    `).all(this._sessionId);

    const usage: Record<string, number> = {};
    for (const row of results) {
      usage[row.tool_name] = row.count;
    }

    return usage;
  }

  /**
   * Format tool usage for display
   */
  formatToolUsage(): string {
    const usage = this.getToolUsage();

    if (Object.keys(usage).length === 0) {
      return '';
    }

    const parts: string[] = [];
    const toolOrder = ['Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'Task'];

    // Show tools in preferred order
    for (const tool of toolOrder) {
      if (usage[tool]) {
        parts.push(`${tool} x${usage[tool]}`);
      }
    }

    // Show other tools
    for (const [tool, count] of Object.entries(usage)) {
      if (!toolOrder.includes(tool)) {
        parts.push(`${tool} x${count}`);
      }
    }

    return parts.join(' | ');
  }

  /**
   * Get weekly limit warning flag
   * Returns: { percentage: number, exceeded: boolean } | null
   */
  getWeeklyLimitWarning(providerModel: string): { percentage: number; exceeded: boolean } | null {
    const key = `weekly_warning_${providerModel}_${this.currentWeek}`;
    const result = this.db.query<{ value: string }, [string]>(
      'SELECT value FROM metadata WHERE key = ?'
    ).get(key);

    if (!result?.value) {
      return null;
    }

    try {
      return JSON.parse(result.value);
    } catch {
      return null;
    }
  }

  /**
   * Set weekly limit warning flag
   */
  setWeeklyLimitWarning(providerModel: string, percentage: number, exceeded: boolean): void {
    const key = `weekly_warning_${providerModel}_${this.currentWeek}`;
    const value = JSON.stringify({ percentage, exceeded });

    this.db.run(
      'INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES (?, ?, datetime("now"))',
      [key, value]
    );
  }

  /**
   * Clear weekly limit warning flag
   */
  clearWeeklyLimitWarning(providerModel: string): void {
    const key = `weekly_warning_${providerModel}_${this.currentWeek}`;
    this.db.run('DELETE FROM metadata WHERE key = ?', [key]);
  }

  close(): void {
    this.db.close();
  }
}
