/**
 * Git status detection with caching
 */

import { $ } from 'bun';
import { join } from 'path';
import { existsSync, statSync } from 'fs';
import type { GitStatus } from './types.js';

// Cache for git status (keyed by cwd)
const gitCache = new Map<string, {
  status: GitStatus;
  indexMtime: number;
  headMtime: number;
}>();

// Cache TTL in ms (500ms - short enough for interactive use)
const CACHE_TTL = 500;

/**
 * Get mtime of a file, returns 0 if not exists
 */
function getFileMtime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    // Quick git dir check (single command)
    const gitDir = await $`git rev-parse --git-dir 2>/dev/null`
      .cwd(cwd).quiet().text().then(s => s.trim()).catch(() => '');

    if (!gitDir) {
      return { branch: '未初始化', states: [] };
    }

    const fullGitDir = gitDir.startsWith('/') ? gitDir : join(cwd, gitDir);
    const indexPath = join(fullGitDir, 'index');
    const headPath = join(fullGitDir, 'HEAD');

    // Check cache validity
    const now = Date.now();
    const cached = gitCache.get(cwd);
    const indexMtime = getFileMtime(indexPath);
    const headMtime = getFileMtime(headPath);

    if (cached &&
        (now - cached.indexMtime < CACHE_TTL || cached.indexMtime === indexMtime) &&
        cached.headMtime === headMtime) {
      // Cache hit - index hasn't changed or very recent
      return cached.status;
    }

    // Get branch name
    const branch = await $`git symbolic-ref --short HEAD 2>/dev/null || git describe --tags --exact-match 2>/dev/null || echo "HEAD"`
      .cwd(cwd).text().then(s => s.trim());

    const states: string[] = [];
    const isDetached = branch === 'HEAD';

    if (isDetached) {
      states.push('detached');
    }

    // Check for merge/rebase/cherry-pick in progress
    if (existsSync(join(fullGitDir, 'MERGE_HEAD'))) {
      if (!states.includes('detached')) states.push('merge');
    } else if (existsSync(join(fullGitDir, 'REBASE_HEAD'))) {
      if (!states.includes('detached')) states.push('rebase');
    } else if (existsSync(join(fullGitDir, 'CHERRY_PICK_HEAD'))) {
      if (!states.includes('detached')) states.push('cherry-pick');
    }

    const status: GitStatus = { branch, states };

    // Update cache
    gitCache.set(cwd, {
      status,
      indexMtime,
      headMtime,
    });

    return status;
  } catch {
    return null;
  }
}

export function formatGitStatus(git: GitStatus | null, colors?: {
  branch?: string;
  error?: string;
  reset?: string;
}): string {
  if (!git) return '';

  const branchColor = colors?.branch || '';
  const errorColor = colors?.error || '';
  const reset = colors?.reset || '';

  if (git.states.length === 0) {
    // Clean state - only show branch name
    return `${branchColor}${git.branch}${reset}`;
  }

  // Show branch with states (detached, merge, rebase, cherry-pick)
  return `${branchColor}${git.branch}${reset} ${errorColor}[${git.states.join('|')}]${reset}`;
}
