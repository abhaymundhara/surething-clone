import { SignJWT, jwtVerify } from 'jose';
import { hash, verify } from './password.js';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
const JWT_ISSUER = 'surething-clone';
const JWT_EXPIRY = '7d';

export interface JWTPayload {
  sub: string; // userId
  email: string;
}

export async function createToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setSubject(userId)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: JWT_ISSUER });
  return { sub: payload.sub as string, email: payload.email as string };
}

export { hash as hashPassword, verify as verifyPassword };
