import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createToken, hashPassword, verifyPassword } from '../lib/auth.js';

const auth = new Hono();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

auth.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const { email, password, name } = parsed.data;

  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return c.json({ success: false, error: 'Email already registered' }, 409);
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    name: name || null,
  }).returning();

  const token = await createToken(user.id, user.email);
  return c.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
});

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const token = await createToken(user.id, user.email);
  return c.json({ success: true, data: { token, user: { id: user.id, email: user.email, name: user.name } } });
});

auth.get('/me', async (c) => {
  const userId = c.get('userId' as never) as string;
  if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    timezone: users.timezone,
    language: users.language,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) return c.json({ success: false, error: 'User not found' }, 404);
  return c.json({ success: true, data: user });
});

export default auth;
