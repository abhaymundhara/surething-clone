import { SignJWT, jwtVerify } from 'jose';
import { hash, verify } from './password.js';

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW || JWT_SECRET_RAW === 'change-this-to-a-random-secret') {
  console.warn('[Auth] WARNING: JWT_SECRET is not set or is using the default value. Set a strong random secret in .env');
}

const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || 'dev-secret-change-me');
const JWT_ISSUER = 'surething-clone';
const JWT_AUDIENCE = 'surething-clone';

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as { sub: string };
  } catch {
    return null;
  }
}

export { hash, verify };
