import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { registerGitHubTools } from '../connectors/github/tools.js';

// ═══════════════════════════════════════════════════════
// SKILL SYSTEM — Pluggable capability loader
// ═══════════════════════════════════════════════════════

export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  loaded: boolean;
}

const skills: Skill[] = [];

export function initializeSkills(): void {
  // Register GitHub tools
  registerGitHubTools();
  skills.push({
    name: 'github',
    description: 'GitHub integration: repos, issues, PRs, commits, branches, code search, actions',
    triggers: ['github', 'repo', 'issue', 'pull request', 'PR', 'commit', 'branch', 'code'],
    loaded: true,
  });

  console.log(`[Skills] ${skills.length} skill(s) loaded: ${skills.map(s => s.name).join(', ')}`);
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
