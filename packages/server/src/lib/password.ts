import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verify(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}
