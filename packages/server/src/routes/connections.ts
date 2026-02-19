import { Hono } from 'hono';
import { db } from '../db/index.js';
import { connections } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const connectionRoutes = new Hono();

// List connections
connectionRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const conns = await db.select({
    id: connections.id,
    provider: connections.provider,
    status: connections.status,
    metadata: connections.metadata,
    createdAt: connections.createdAt,
  }).from(connections).where(eq(connections.userId, userId));
  return c.json({ success: true, data: conns });
});

// Start GitHub OAuth
connectionRoutes.get('/github/auth', async (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return c.json({ success: false, error: 'GitHub OAuth not configured' }, 500);
  }

  const state = crypto.randomUUID();
  // TODO: Store state in Redis for CSRF validation

  const url = `https://github.com/login/oauth/authorize?` +
    `client_id=${clientId}&` +
    `scope=repo,read:user&` +
    `state=${state}&` +
    `redirect_uri=${encodeURIComponent(process.env.GITHUB_CALLBACK_URL || '')}`;

  return c.json({ success: true, data: { url, state } });
});

// GitHub OAuth callback
connectionRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code) {
    return c.json({ success: false, error: 'Missing authorization code' }, 400);
  }

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json() as any;
  if (tokenData.error) {
    return c.json({ success: false, error: tokenData.error_description || tokenData.error }, 400);
  }

  // Get GitHub user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const githubUser = await userRes.json() as any;

  // For now, get userId from the first user (single-user system)
  // TODO: Get from session/JWT
  const userId = c.get('userId' as never) as string || '';

  // Upsert connection
  const existing = await db.select().from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.provider, 'github')))
    .limit(1);

  if (existing.length > 0) {
    await db.update(connections)
      .set({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        metadata: { login: githubUser.login, avatar_url: githubUser.avatar_url, name: githubUser.name },
        status: 'active',
      })
      .where(eq(connections.id, existing[0].id));
  } else {
    await db.insert(connections).values({
      userId,
      provider: 'github',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      metadata: { login: githubUser.login, avatar_url: githubUser.avatar_url, name: githubUser.name },
    });
  }

  // Redirect to app
  return c.redirect(process.env.CORS_ORIGIN || 'http://localhost:1420');
});

// Disconnect
connectionRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId' as never) as string;
  const connId = c.req.param('id');
  await db.update(connections)
    .set({ status: 'disconnected' })
    .where(and(eq(connections.id, connId), eq(connections.userId, userId)));
  return c.json({ success: true });
});

export default connectionRoutes;
