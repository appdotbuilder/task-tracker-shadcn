import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, timingSafeEqual } from 'crypto';

// Simple JWT-like token generation using crypto module
const generateToken = (payload: { userId: number; email: string }): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ 
    ...payload, 
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iat: Date.now() + Math.random() // Add randomness to ensure unique tokens
  })).toString('base64url');
  
  const secret = process.env['JWT_SECRET'] || 'default-secret-key';
  const signature = createHash('sha256')
    .update(`${header}.${body}.${secret}`)
    .digest('base64url');
  
  return `${header}.${body}.${signature}`;
};

// Simple password verification using crypto
const verifyPassword = (password: string, hash: string): boolean => {
  const hashedInput = createHash('sha256').update(password).digest('hex');
  
  if (hashedInput.length !== hash.length) {
    return false;
  }
  
  return timingSafeEqual(
    Buffer.from(hashedInput, 'hex'),
    Buffer.from(hash, 'hex')
  );
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = verifyPassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    // Return user data without password hash and token
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};