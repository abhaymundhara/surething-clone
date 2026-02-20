import { Hono } from 'hono';
import { db } from '../db/index.js';
import { connections } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════
// CONNECTIONS — OAuth integration management
// ═══════════════════════════════════════════════════════

const app = new Hono();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// In-memory CSRF state store (short-lived)
const oauthStates = new Map<string, { userId: string; createdAt: number }>();

// Cleanup stale states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthStates.delete(key);
  }
}, 5 * 60 * 1000);

// List connections
app.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const conns = await db.select().from(connections)
    .where(eq(connections.userId, userId));
  return c.json(conns);
});

// Initiate GitHub OAuth
app.get('/github/auth', async (c) => {
  const userId = c.get('userId') as string;
  if (!GITHUB_CLIENT_ID) {
    return c.json({ error: 'GitHub OAuth not configured' }, 500);
  }

  const state = uuidv4();
  oauthStates.set(state, { userId, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/connections/github/callback`,
    scope: 'repo read:user user:email',
    state,
  });

  return c.json({ url: `https://github.com/login/oauth/authorize?${params}` });
});

// GitHub OAuth callback (this route is hit directly by GitHub redirect, no auth middleware)
app.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.html('<h1>Error: Missing code or state</h1>', 400);
  }

  // Verify CSRF state
  const stateData = oauthStates.get(state);
  if (!stateData) {
    return c.html('<h1>Error: Invalid or expired OAuth state</h1>', 403);
  }
  oauthStates.delete(state);
  const userId = stateData.userId;

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      return c.html(`<h1>Error: ${tokenData.error || 'Failed to get access token'}</h1>`, 400);
    }

    // Get GitHub user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userRes.json() as { login: string; id: number };

    // Upsert connection
    const existing = await db.select().from(connections)
      .where(and(eq(connections.userId, userId), eq(connections.provider, 'github')))
      .limit(1);

    if (existing.length > 0) {
      await db.update(connections)
        .set({
          accessToken: tokenData.access_token,
          metadata: { login: githubUser.login, id: githubUser.id },
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(connections.id, existing[0].id));
    } else {
      await db.insert(connections).values({
        userId,
        provider: 'github',
        accessToken: tokenData.access_token,
        metadata: { login: githubUser.login, id: githubUser.id },
        status: 'active',
      });
    }

    return c.html('<h1>GitHub connected! You can close this window.</h1>');
  } catch (e) {
    console.error('[Connections] GitHub OAuth error:', (e as Error).message);
    return c.html('<h1>Error connecting GitHub</h1>', 500);
  }
});

// Disconnect a connection
app.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const connId = c.req.param('id');

  const [conn] = await db.select().from(connections)
    .where(and(eq(connections.id, connId), eq(connections.userId, userId)))
    .limit(1);

  if (!conn) return c.json({ error: 'Connection not found' }, 404);

  await db.update(connections)
    .set({ status: 'disconnected', updatedAt: new Date() })
    .where(eq(connections.id, connId));

  return c.json({ success: true });
});

export default app;
