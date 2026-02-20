import { Context, Next } from 'hono';
import { verifyToken } from '../lib/auth.js';

/**
 * JWT auth middleware — extracts userId from Bearer token and sets it on context.
 * Skips auth for /api/auth/login, /api/auth/register, and /api/connections/github/callback.
 */
export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  // Public routes
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/connections/github/callback',
    '/api/health',
    '/api/ws',
  ];
  if (publicPaths.some(p => path.startsWith(p))) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    c.set('userId' as never, payload.sub as never);
    c.set('userEmail' as never, payload.email as never);
    return next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
}
