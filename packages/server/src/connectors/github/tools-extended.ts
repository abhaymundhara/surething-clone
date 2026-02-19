import { getGitHubClient } from './client.js';
import { registerExternalTools } from '../../agent/tools.js';

// ═══════════════════════════════════════════════════════
// EXTENDED GITHUB TOOLS
// Additional tools that were missing from the initial build
// ═══════════════════════════════════════════════════════

export function registerExtendedGitHubTools(): void {
  registerExternalTools([
    {
      name: 'github_create_branch',
      description: 'Create a new branch from an existing branch or commit SHA.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          branch: { type: 'string', description: 'New branch name' },
          from_branch: { type: 'string', description: 'Source branch (default: default branch)' },
        },
        required: ['owner', 'repo', 'branch'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        // Get the SHA of the source branch
        const fromBranch = (args.from_branch as string) || 'main';
        const { data: ref } = await octokit.rest.git.getRef({
          owner: args.owner as string,
          repo: args.repo as string,
          ref: `heads/${fromBranch}`,
        });
        // Create the new branch
        const { data } = await octokit.rest.git.createRef({
          owner: args.owner as string,
          repo: args.repo as string,
          ref: `refs/heads/${args.branch as string}`,
          sha: ref.object.sha,
        });
        return { branch: args.branch, sha: data.object.sha, url: data.url };
      },
    },

    {
      name: 'github_merge_pr',
      description: 'Merge a pull request.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          pull_number: { type: 'number' },
          merge_method: { type: 'string', enum: ['merge', 'squash', 'rebase'], description: 'Merge method' },
          commit_message: { type: 'string', description: 'Custom merge commit message' },
        },
        required: ['owner', 'repo', 'pull_number'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.pulls.merge({
          owner: args.owner as string,
          repo: args.repo as string,
          pull_number: args.pull_number as number,
          merge_method: (args.merge_method as 'merge' | 'squash' | 'rebase') || 'merge',
          commit_message: args.commit_message as string,
        });
        return { merged: data.merged, sha: data.sha, message: data.message };
      },
    },

    {
      name: 'github_compare_branches',
      description: 'Compare two branches and show the diff summary.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          base: { type: 'string', description: 'Base branch' },
          head: { type: 'string', description: 'Head branch' },
        },
        required: ['owner', 'repo', 'base', 'head'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.repos.compareCommits({
          owner: args.owner as string,
          repo: args.repo as string,
          base: args.base as string,
          head: args.head as string,
        });
        return {
          status: data.status,
          aheadBy: data.ahead_by,
          behindBy: data.behind_by,
          totalCommits: data.total_commits,
          files: data.files?.map(f => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
          })),
          url: data.html_url,
        };
      },
    },

    {
      name: 'github_get_pr_diff',
      description: 'Get the diff/changed files of a pull request.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          pull_number: { type: 'number' },
        },
        required: ['owner', 'repo', 'pull_number'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.pulls.listFiles({
          owner: args.owner as string,
          repo: args.repo as string,
          pull_number: args.pull_number as number,
          per_page: 50,
        });
        return {
          files: data.map(f => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch?.substring(0, 500), // Truncate large patches
          })),
          totalFiles: data.length,
        };
      },
    },

    {
      name: 'github_search_issues',
      description: 'Search issues and PRs across repositories using GitHub search syntax.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (e.g., "bug label:critical repo:owner/name")' },
          per_page: { type: 'number' },
        },
        required: ['query'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.search.issuesAndPullRequests({
          q: args.query as string,
          per_page: (args.per_page as number) || 10,
        });
        return {
          results: data.items.map(item => ({
            number: item.number,
            title: item.title,
            state: item.state,
            type: item.pull_request ? 'pr' : 'issue',
            repo: item.repository_url.split('/').slice(-2).join('/'),
            labels: item.labels.map(l => typeof l === 'string' ? l : l.name),
            created: item.created_at,
            url: item.html_url,
          })),
          totalCount: data.total_count,
        };
      },
    },

    {
      name: 'github_add_issue_comment',
      description: 'Add a comment to an issue or pull request.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          issue_number: { type: 'number' },
          body: { type: 'string', description: 'Comment text (markdown supported)' },
        },
        required: ['owner', 'repo', 'issue_number', 'body'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.issues.createComment({
          owner: args.owner as string,
          repo: args.repo as string,
          issue_number: args.issue_number as number,
          body: args.body as string,
        });
        return { id: data.id, url: data.html_url };
      },
    },

    {
      name: 'github_trigger_workflow',
      description: 'Trigger a GitHub Actions workflow dispatch event.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          workflow_id: { type: 'string', description: 'Workflow file name (e.g., "ci.yml") or ID' },
          ref: { type: 'string', description: 'Branch or tag to run on' },
          inputs: { type: 'object', description: 'Workflow dispatch inputs' },
        },
        required: ['owner', 'repo', 'workflow_id', 'ref'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        await octokit.rest.actions.createWorkflowDispatch({
          owner: args.owner as string,
          repo: args.repo as string,
          workflow_id: args.workflow_id as string,
          ref: args.ref as string,
          inputs: args.inputs as Record<string, string>,
        });
        return { triggered: true, workflow: args.workflow_id, ref: args.ref };
      },
    },
  ]);

  console.log('[GitHub] 7 extended GitHub tools registered (total: 19)');
}
