/**
 * Git status detection
 */

import { $ } from 'bun';
import { join } from 'path';
import { existsSync } from 'fs';
import type { GitStatus } from './types.js';

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    // Check if in git repo
    const gitDir = await $`git rev-parse --git-dir 2>/dev/null`
      .cwd(cwd).quiet().text().then(s => s.trim()).catch(() => '');

    if (!gitDir) {
      // Not a git repo
      return { branch: '未初始化', states: [] };
    }

    const fullGitDir = gitDir.startsWith('/') ? gitDir : join(cwd, gitDir);

    // Get branch name
    const branch = await $`git symbolic-ref --short HEAD 2>/dev/null || git describe --tags --exact-match 2>/dev/null || echo "HEAD"`
      .cwd(cwd).text().then(s => s.trim());

    const states: string[] = [];

    // Check for special states (priority order)
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

    return { branch, states };
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

  // Check if there are error states (detached, merge, etc.)
  const hasErrorStates = git.states.length > 0;

  if (hasErrorStates) {
    // Show branch with error states
    return `${branchColor}${git.branch}${reset} ${errorColor}[${git.states.join('|')}]${reset}`;
  }

  // Show branch with states
  return `${branchColor}${git.branch}${reset} [${git.states.join('|')}]`;
}
