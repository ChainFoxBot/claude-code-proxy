#!/usr/bin/env bun
/**
 * Statusline CLI script
 * Reads stdin from Claude Code and outputs formatted statusline string
 */

import { StatuslineTracker } from './tracker.js';
import { getGitStatus, formatGitStatus } from './git.js';
import { getContextWindowSize, checkWeeklyLimitAsync } from './config.js';
import type { StdinData } from './types.js';

/**
 * ANSI color codes (24-bit true color)
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  // Custom colors (24-bit true color with bold) - vivid/saturated
  model: '\x1b[1;38;2;80;210;255m',     // #50d2ff - vivid cyan blue
  folder: '\x1b[1;38;2;255;240;80m',    // #fff050 - vivid yellow
  gitBranch: '\x1b[1;38;2;255;90;200m', // #ff5ac8 - vivid pink
  gitError: '\x1b[1;38;2;255;75;65m',   // #ff4b41 - vivid red
  tokens: '\x1b[1;38;2;210;90;255m',    // #d25aff - vivid purple
  green: '\x1b[1;38;2;80;255;120m',     // #50ff78 - vivid green
  yellow: '\x1b[1;38;2;255;215;0m',     // #ffd700 - yellow
  red: '\x1b[1;38;2;255;60;60m',        // #ff3c3c - vivid red
  separator: '\x1b[1;38;2;239;240;235m', // #eff0eb - light gray for separators
};

/**
 * Colorize text
 */
function colorize(text: string, color: string): string {
  return `${color}${text}${colors.reset}`;
}

async function readStdin(): Promise<StdinData | null> {
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
    return JSON.parse(raw) as StdinData;
  } catch (error) {
    // Log parse errors for debugging (protocol mismatch detection)
    if (process.env.STATUSLINE_DEBUG === 'true') {
      console.error('Statusline stdin parse error:', error);
    }
    return null;
  }
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}k`;
  }
  return String(tokens);
}

async function main() {
  try {
    // Read stdin from Claude Code
    const stdin = await readStdin();
    if (!stdin) {
      console.log('cc-proxy statusline ready');
      return;
    }

    // Use official CLAUDE_SESSION_ID (shared with hooks)
    const sessionId = process.env.CLAUDE_SESSION_ID || 'default';

    // Initialize tracker
    const tracker = new StatuslineTracker(sessionId);

    // Get model name
    const model = stdin.model?.display_name || stdin.model?.id || 'Unknown';

    // Get Claude Code's context percentage (use official field directly)
    const claudeContextPercent = typeof stdin.context_window?.used_percentage === 'number'
      ? Math.round(stdin.context_window.used_percentage)
      : 0;

    // Get session tokens from official fields (show total)
    const totalInputTokens = stdin.context_window?.total_input_tokens || 0;
    const totalOutputTokens = stdin.context_window?.total_output_tokens || 0;
    const totalTokens = totalInputTokens + totalOutputTokens;
    const sessionTokens = totalTokens > 0
      ? `${formatTokens(totalTokens)} tokens`
      : '0 tokens';

    // Get last provider:model used
    const lastProviderModel = tracker.getLastProviderModel();

    // Debug logging (only in verbose mode)
    if (process.env.STATUSLINE_DEBUG === 'true') {
      console.error('Debug:', {
        sessionId,
        totalInputTokens,
        totalOutputTokens,
        lastProviderModel,
        stdinContext: stdin.context_window
      });
    }

    // Calculate actual context percentage based on window size ratio
    let actualContextPercent: number | null = null;
    if (lastProviderModel && claudeContextPercent > 0 && stdin.context_window?.context_window_size) {
      const claudeWindowSize = stdin.context_window.context_window_size;
      const actualWindowSize = getContextWindowSize(lastProviderModel);

      if (actualWindowSize && actualWindowSize > 0) {
        // Calculate actual percentage based on window size ratio
        // Formula: actual% = claude% * (claude_window / actual_window)
        actualContextPercent = Math.min(100, Math.round(
          claudeContextPercent * (claudeWindowSize / actualWindowSize)
        ));
      }
    }

    // Get git status (async)
    const gitStatus = await getGitStatus(stdin.cwd);

    // Check weekly limit warning flag (from async background check)
    let weeklyWarning: string | null = null;
    if (lastProviderModel) {
      // Get warning flag from tracker (set by async background check)
      const warningFlag = tracker.getWeeklyLimitWarning(lastProviderModel);

      if (warningFlag && warningFlag.percentage >= 70) {
        // Color based on percentage
        let warningColor = colors.yellow;
        if (warningFlag.percentage >= 90) {
          warningColor = colors.red;
        }

        const warningText = warningFlag.exceeded
          ? `LIMIT EXCEEDED (${warningFlag.percentage}%)`
          : `${warningFlag.percentage}% of weekly limit`;
        weeklyWarning = colorize(`⚠️ ${warningText}`, warningColor);
      }

      // Run async check in background (don't wait)
      checkWeeklyLimitAsync(
        lastProviderModel,
        {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
        70 // Lower threshold to catch warnings earlier
      ).then((result) => {
        if (result && result.percentage >= 70) {
          // Update warning flag
          tracker.setWeeklyLimitWarning(
            lastProviderModel,
            result.percentage,
            result.exceeded
          );
        } else {
          // Clear warning flag if below threshold
          tracker.clearWeeklyLimitWarning(lastProviderModel);
        }
      }).catch(() => {
        // Silent fail
      });
    }

    // Format output
    const parts: string[] = [];

    // 1. Model name (colored)
    parts.push(colorize(`[${model}]`, colors.model));

    // 2. Context window usage (color based on percentage)
    const contextPercent = actualContextPercent !== null ? actualContextPercent : claudeContextPercent;
    let contextColor = colors.green;
    if (contextPercent >= 70) {
      contextColor = colors.red;
    } else if (contextPercent >= 50) {
      contextColor = colors.yellow;
    }

    if (actualContextPercent !== null) {
      // Show actual provider context percentage
      if (actualContextPercent !== claudeContextPercent && claudeContextPercent > 0) {
        // Show both if different and Claude's is non-zero
        parts.push(colorize(`${claudeContextPercent}% (实际 ${actualContextPercent}%)`, contextColor));
      } else {
        parts.push(colorize(`${actualContextPercent}%`, contextColor));
      }
    } else if (claudeContextPercent > 0) {
      // Fallback to Claude's context percentage
      parts.push(colorize(`${claudeContextPercent}%`, contextColor));
    } else {
      // No context info available
      parts.push(colorize('0%', contextColor));
    }

    // 3. Session tokens (colored)
    parts.push(colorize(sessionTokens, colors.tokens));

    // 4. Folder name and git status (colored)
    const folderName = stdin.cwd ? stdin.cwd.split('/').pop() : '';
    const branchSymbol = '\ue0a0'; // Powerline branch symbol

    // Get git status string with colors
    const gitStatusStr = gitStatus ? formatGitStatus(gitStatus, {
      branch: colors.gitBranch,
      error: colors.gitError,
      reset: colors.reset
    }) : '';

    if (folderName && gitStatusStr) {
      // Colorize folder name
      const coloredFolder = colorize(folderName, colors.folder);
      // Colorize branch symbol
      const coloredBranch = colorize(branchSymbol, colors.gitBranch);

      parts.push(`${coloredFolder} ${colorize('on', colors.separator)} ${coloredBranch} ${gitStatusStr}`);
    } else if (gitStatusStr) {
      parts.push(gitStatusStr);
    } else if (folderName) {
      parts.push(colorize(folderName, colors.folder));
    }

    // 5. Weekly warning (if any, from previous check)
    if (weeklyWarning) {
      parts.push(weeklyWarning);
    }

    const sep = colorize(' | ', colors.separator);
    console.log(parts.join(sep));

    // Note: Don't close tracker here - the async weekly limit check
    // may still be writing to the database. Let process exit handle cleanup.
  } catch (error) {
    // Log unexpected errors for debugging, but don't break Claude Code
    if (process.env.STATUSLINE_DEBUG === 'true') {
      console.error('Statusline error:', error);
    }
    console.log('');
  }
}

main();
