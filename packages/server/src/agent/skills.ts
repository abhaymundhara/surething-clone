import { registerGitHubTools } from '../connectors/github/tools.js';
import { registerExtendedGitHubTools } from '../connectors/github/tools-extended.js';
import { registerWorkspaceTools } from './workspace-tools.js';

// ═══════════════════════════════════════════════════════
// SKILL SYSTEM — Pluggable capability loader
// ═══════════════════════════════════════════════════════

export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  loaded: boolean;
}

const skills: Skill[] = [];

export function initializeSkills(): void {
  // Core tools: workspace file management
  registerWorkspaceTools();
  skills.push({
    name: 'workspace',
    description: 'Workspace file management for persistent task state and configuration.',
    triggers: ['workspace', 'file', 'config', 'save', 'persist'],
    tools: ['workspace_read', 'workspace_write', 'workspace_list', 'workspace_delete'],
    loaded: true,
  });

  // GitHub tools (base + extended = 19 tools)
  registerGitHubTools();
  registerExtendedGitHubTools();
  skills.push({
    name: 'github',
    description: 'GitHub integration: repos, issues, PRs, commits, branches, code search, actions, webhooks.',
    triggers: ['github', 'repo', 'issue', 'pull request', 'PR', 'commit', 'branch', 'code', 'merge', 'workflow', 'CI'],
    tools: [
      'github_list_repos', 'github_get_repo', 'github_list_issues', 'github_create_issue',
      'github_update_issue', 'github_list_prs', 'github_create_pr', 'github_list_commits',
      'github_list_branches', 'github_search_code', 'github_get_file', 'github_list_workflows',
      'github_create_branch', 'github_merge_pr', 'github_compare_branches', 'github_get_pr_diff',
      'github_search_issues', 'github_add_issue_comment', 'github_trigger_workflow',
    ],
    loaded: true,
  });

  console.log(`[Skills] ${skills.length} skill(s) loaded: ${skills.map(s => `${s.name} (${s.tools.length} tools)`).join(', ')}`);
}

export function getLoadedSkills(): Skill[] {
  return skills;
}

export function getSkillForQuery(query: string): Skill | null {
  const lower = query.toLowerCase();
  for (const skill of skills) {
    if (skill.triggers.some(t => lower.includes(t.toLowerCase()))) {
      return skill;
    }
  }
  return null;
}
