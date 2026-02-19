import { getGitHubClient } from './client.js';
import { registerExternalTools } from '../../agent/tools.js';

// ═══════════════════════════════════════════════════════
// GITHUB TOOLS — Registered with the agent tool system
// ═══════════════════════════════════════════════════════

export function registerGitHubTools(): void {
  registerExternalTools([
    // ─── Repository Operations ─────────────────────
    {
      name: 'github_list_repos',
      description: 'List repositories for the authenticated GitHub user. Can filter by type.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['all', 'owner', 'public', 'private', 'member'], description: 'Type filter' },
          sort: { type: 'string', enum: ['created', 'updated', 'pushed', 'full_name'] },
          per_page: { type: 'number', description: 'Results per page (max 100)' },
        },
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          type: (args.type as string) || 'all',
          sort: (args.sort as string) || 'updated',
          per_page: (args.per_page as number) || 30,
        });
        return {
          repos: data.map(r => ({
            name: r.full_name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            updated: r.updated_at,
            url: r.html_url,
            private: r.private,
          })),
        };
      },
    },

    {
      name: 'github_get_repo',
      description: 'Get detailed information about a specific repository.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.repos.get({
          owner: args.owner as string,
          repo: args.repo as string,
        });
        return {
          name: data.full_name,
          description: data.description,
          language: data.language,
          stars: data.stargazers_count,
          forks: data.forks_count,
          openIssues: data.open_issues_count,
          defaultBranch: data.default_branch,
          url: data.html_url,
        };
      },
    },

    // ─── Issue Operations ──────────────────────────
    {
      name: 'github_list_issues',
      description: 'List issues in a repository. Can filter by state, labels, assignee.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
          labels: { type: 'string', description: 'Comma-separated label names' },
          assignee: { type: 'string' },
          per_page: { type: 'number' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.issues.listForRepo({
          owner: args.owner as string,
          repo: args.repo as string,
          state: (args.state as 'open' | 'closed' | 'all') || 'open',
          labels: args.labels as string,
          assignee: args.assignee as string,
          per_page: (args.per_page as number) || 20,
        });
        return {
          issues: data.filter(i => !i.pull_request).map(i => ({
            number: i.number,
            title: i.title,
            state: i.state,
            labels: i.labels.map(l => typeof l === 'string' ? l : l.name),
            assignee: i.assignee?.login,
            created: i.created_at,
            url: i.html_url,
          })),
        };
      },
    },

    {
      name: 'github_create_issue',
      description: 'Create a new issue in a repository. Returns the created issue details.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          assignees: { type: 'array', items: { type: 'string' } },
        },
        required: ['owner', 'repo', 'title'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.issues.create({
          owner: args.owner as string,
          repo: args.repo as string,
          title: args.title as string,
          body: args.body as string,
          labels: args.labels as string[],
          assignees: args.assignees as string[],
        });
        return {
          number: data.number,
          title: data.title,
          url: data.html_url,
          state: data.state,
        };
      },
    },

    {
      name: 'github_update_issue',
      description: 'Update an existing issue (title, body, state, labels, assignees).',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          issue_number: { type: 'number' },
          title: { type: 'string' },
          body: { type: 'string' },
          state: { type: 'string', enum: ['open', 'closed'] },
          labels: { type: 'array', items: { type: 'string' } },
          assignees: { type: 'array', items: { type: 'string' } },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.issues.update({
          owner: args.owner as string,
          repo: args.repo as string,
          issue_number: args.issue_number as number,
          ...(args.title && { title: args.title as string }),
          ...(args.body && { body: args.body as string }),
          ...(args.state && { state: args.state as 'open' | 'closed' }),
          ...(args.labels && { labels: args.labels as string[] }),
          ...(args.assignees && { assignees: args.assignees as string[] }),
        });
        return { number: data.number, title: data.title, state: data.state, url: data.html_url };
      },
    },

    // ─── Pull Request Operations ────────────────────
    {
      name: 'github_list_prs',
      description: 'List pull requests in a repository.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
          per_page: { type: 'number' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.pulls.list({
          owner: args.owner as string,
          repo: args.repo as string,
          state: (args.state as 'open' | 'closed' | 'all') || 'open',
          per_page: (args.per_page as number) || 20,
        });
        return {
          pullRequests: data.map(pr => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            author: pr.user?.login,
            head: pr.head.ref,
            base: pr.base.ref,
            mergeable: pr.mergeable,
            url: pr.html_url,
          })),
        };
      },
    },

    {
      name: 'github_create_pr',
      description: 'Create a pull request.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          head: { type: 'string', description: 'Branch with changes' },
          base: { type: 'string', description: 'Branch to merge into' },
        },
        required: ['owner', 'repo', 'title', 'head', 'base'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.pulls.create({
          owner: args.owner as string,
          repo: args.repo as string,
          title: args.title as string,
          body: args.body as string,
          head: args.head as string,
          base: args.base as string,
        });
        return { number: data.number, title: data.title, url: data.html_url };
      },
    },

    // ─── Branch & Commit Operations ─────────────────
    {
      name: 'github_list_commits',
      description: 'List recent commits in a repository.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          sha: { type: 'string', description: 'Branch name or SHA' },
          per_page: { type: 'number' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.repos.listCommits({
          owner: args.owner as string,
          repo: args.repo as string,
          sha: args.sha as string,
          per_page: (args.per_page as number) || 10,
        });
        return {
          commits: data.map(c => ({
            sha: c.sha.substring(0, 7),
            message: c.commit.message,
            author: c.commit.author?.name,
            date: c.commit.author?.date,
            url: c.html_url,
          })),
        };
      },
    },

    {
      name: 'github_list_branches',
      description: 'List branches in a repository.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.repos.listBranches({
          owner: args.owner as string,
          repo: args.repo as string,
          per_page: 50,
        });
        return { branches: data.map(b => ({ name: b.name, protected: b.protected })) };
      },
    },

    // ─── Code Search & File Access ──────────────────
    {
      name: 'github_search_code',
      description: 'Search for code across repositories.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (can include repo:owner/name qualifier)' },
          per_page: { type: 'number' },
        },
        required: ['query'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.search.code({
          q: args.query as string,
          per_page: (args.per_page as number) || 10,
        });
        return {
          results: data.items.map(item => ({
            path: item.path,
            repo: item.repository.full_name,
            url: item.html_url,
            score: item.score,
          })),
          totalCount: data.total_count,
        };
      },
    },

    {
      name: 'github_get_file',
      description: 'Get the content of a file from a repository.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          path: { type: 'string' },
          ref: { type: 'string', description: 'Branch or commit SHA' },
        },
        required: ['owner', 'repo', 'path'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.repos.getContent({
          owner: args.owner as string,
          repo: args.repo as string,
          path: args.path as string,
          ...(args.ref && { ref: args.ref as string }),
        });
        if ('content' in data && data.encoding === 'base64') {
          return {
            path: data.path,
            content: Buffer.from(data.content, 'base64').toString('utf-8'),
            size: data.size,
            sha: data.sha,
          };
        }
        return { path: (data as any).path, type: 'directory' };
      },
    },

    // ─── GitHub Actions ─────────────────────────────
    {
      name: 'github_list_workflows',
      description: 'List GitHub Actions workflow runs for a repository.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          per_page: { type: 'number' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args, ctx) => {
        const octokit = await getGitHubClient(ctx.userId);
        const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
          owner: args.owner as string,
          repo: args.repo as string,
          per_page: (args.per_page as number) || 10,
        });
        return {
          runs: data.workflow_runs.map(r => ({
            id: r.id,
            name: r.name,
            status: r.status,
            conclusion: r.conclusion,
            branch: r.head_branch,
            url: r.html_url,
            created: r.created_at,
          })),
        };
      },
    },
  ]);

  console.log('[GitHub] 12 GitHub tools registered');
}
