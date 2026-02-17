#!/usr/bin/env bun
/**
 * PostToolUse hook to track tool usage
 * Reads tool_name from stdin JSON and records to database
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';

interface ToolHookInput {
  tool_name: string;
  tool_input?: any;
  tool_response?: any;
}

async function readStdin(): Promise<ToolHookInput | null> {
  if (process.stdin.isTTY) {
    return null;
  }

  const chunks: string[] = [];

  try {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      chunks.push(chunk as string);
    }
    const raw = chunks.join('');
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw) as ToolHookInput;
  } catch {
    return null;
  }
}

function getSessionId(): string {
  // Try to get session ID from environment or use 'default'
  return process.env.CLAUDE_SESSION_ID || 'default';
}

async function main() {
  try {
    const input = await readStdin();
    if (!input || !input.tool_name) {
      process.exit(0);
    }

    // Get data directory
    const dataDir = join(process.env.HOME || '~', '.claude-code-proxy', 'data');
    const dbPath = join(dataDir, 'statusline.db');

    // Open database
    const db = new Database(dbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA busy_timeout = 5000');

    const sessionId = getSessionId();
    const toolName = input.tool_name;
    const now = new Date().toISOString();

    // Record tool usage
    db.run(`
      INSERT INTO tool_usage (session_id, tool_name, count, last_updated)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(session_id, tool_name) DO UPDATE SET
        count = count + 1,
        last_updated = excluded.last_updated
    `, [sessionId, toolName, now]);

    db.close();
  } catch (error) {
    // Silent fail - don't break Claude Code
    console.error('Tool usage hook error:', error);
  }
}

main();
