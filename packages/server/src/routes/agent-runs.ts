import { Hono } from 'hono';
import { searchAgentRuns } from '../services/agent-log.js';

const agentRunRoutes = new Hono();

agentRunRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const action = c.req.query('action');
  const cellId = c.req.query('cellId');
  const limit = parseInt(c.req.query('limit') || '50');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const runs = await searchAgentRuns({
    userId,
    action: action || undefined,
    cellId: cellId || undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit,
  });

  return c.json({ success: true, data: runs });
});

export default agentRunRoutes;
