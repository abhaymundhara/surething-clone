import { registerExternalTools } from './tools.js';
import { readWorkspaceFile, writeWorkspaceFile, listWorkspaceFiles, deleteWorkspaceFile } from '../services/workspace.js';

// ═══════════════════════════════════════════════════════
// WORKSPACE TOOLS — Persistent file storage for tasks
// ═══════════════════════════════════════════════════════

export function registerWorkspaceTools(): void {
  registerExternalTools([
    {
      name: 'workspace_read',
      description: 'Read a file from the workspace. Use for loading saved task plans, config, scripts, or context.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path within workspace (e.g., "task-plan.md", "config/settings.json")' },
        },
        required: ['path'],
      },
      handler: async (args, ctx) => {
        const content = await readWorkspaceFile(ctx.cellId, args.path as string);
        return content ? { content } : { error: 'File not found' };
      },
    },

    {
      name: 'workspace_write',
      description: 'Write a file to the workspace. Use for persisting task plans, scripts, config, or context for scheduled tasks.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path within workspace' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
      handler: async (args, ctx) => {
        await writeWorkspaceFile(ctx.cellId, args.path as string, args.content as string);
        return { saved: true, path: args.path };
      },
    },

    {
      name: 'workspace_list',
      description: 'List all files in the workspace.',
      parameters: { type: 'object', properties: {} },
      handler: async (_args, ctx) => {
        const files = await listWorkspaceFiles(ctx.cellId);
        return { files };
      },
    },

    {
      name: 'workspace_delete',
      description: 'Delete a file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete' },
        },
        required: ['path'],
      },
      handler: async (args, ctx) => {
        await deleteWorkspaceFile(ctx.cellId, args.path as string);
        return { deleted: true, path: args.path };
      },
    },
  ]);

  console.log('[Workspace] 4 workspace tools registered');
}
