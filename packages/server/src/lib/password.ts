import { createHash, randomBytes } from 'crypto';

export function hash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hashed = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hashed}`;
}

export function verify(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const hashed = createHash('sha256').update(password + salt).digest('hex');
  return hashed === hash;
}
