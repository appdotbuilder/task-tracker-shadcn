import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  try {
    // Check if user with email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash the password using Node.js crypto
    const salt = randomBytes(16).toString('hex');
    const passwordHash = await pbkdf2Async(input.password, salt, 10000, 64, 'sha512');
    const hashedPassword = salt + ':' + passwordHash.toString('hex');

    // Create new user in database
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: hashedPassword,
        name: input.name
      })
      .returning()
      .execute();

    const user = result[0];

    // Generate simple token (in production, use proper JWT library)
    const tokenPayload = JSON.stringify({
      userId: user.id,
      email: user.email,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    const token = Buffer.from(tokenPayload).toString('base64');

    // Return user data (without password) and token
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
    console.error('User registration failed:', error);
    throw error;
  }
};