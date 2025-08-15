import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput } from '../schema';
import { register } from '../handlers/register';
import { eq } from 'drizzle-orm';
import { pbkdf2 } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

// Helper function to verify password against hash
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  const [salt, hash] = hashedPassword.split(':');
  const expectedHash = await pbkdf2Async(password, salt, 10000, 64, 'sha512');
  return hash === expectedHash.toString('hex');
};

// Simple test input
const testInput: RegisterInput = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User'
};

describe('register', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a new user successfully', async () => {
    const result = await register(testInput);

    // Basic field validation
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.name).toEqual('Test User');
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
  });

  it('should save user to database with hashed password', async () => {
    const result = await register(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.name).toEqual('Test User');
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual('password123'); // Should be hashed
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);

    // Verify password was hashed correctly
    const isPasswordValid = await verifyPassword('password123', savedUser.password_hash);
    expect(isPasswordValid).toBe(true);
  });

  it('should generate valid token', async () => {
    const result = await register(testInput);

    // Verify token can be decoded
    const tokenPayload = JSON.parse(Buffer.from(result.token, 'base64').toString());
    expect(tokenPayload.userId).toEqual(result.user.id);
    expect(tokenPayload.email).toEqual('test@example.com');
    expect(tokenPayload.exp).toBeDefined(); // Should have expiration
    expect(tokenPayload.exp).toBeGreaterThan(Date.now()); // Should be in the future
  });

  it('should reject duplicate email addresses', async () => {
    // First registration should succeed
    await register(testInput);

    // Second registration with same email should fail
    await expect(register(testInput)).rejects.toThrow(/already exists/i);
  });

  it('should handle different user data correctly', async () => {
    const differentInput: RegisterInput = {
      email: 'different@example.com',
      password: 'differentpassword',
      name: 'Different User'
    };

    const result = await register(differentInput);

    expect(result.user.email).toEqual('different@example.com');
    expect(result.user.name).toEqual('Different User');

    // Verify in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, 'different@example.com'))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    // Verify password hashing worked for different password
    const isPasswordValid = await verifyPassword('differentpassword', savedUser.password_hash);
    expect(isPasswordValid).toBe(true);
  });

  it('should handle case-sensitive emails correctly', async () => {
    // Register with lowercase email
    await register(testInput);

    // Try to register with uppercase version of same email
    const uppercaseInput: RegisterInput = {
      ...testInput,
      email: 'TEST@EXAMPLE.COM'
    };

    // This should succeed since emails are case-sensitive in our implementation
    const result = await register(uppercaseInput);
    expect(result.user.email).toEqual('TEST@EXAMPLE.COM');

    // Verify both users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });

  it('should not include password_hash in response', async () => {
    const result = await register(testInput);

    // Ensure password_hash is not in the returned user object
    expect('password_hash' in result.user).toBe(false);
    expect((result.user as any).password_hash).toBeUndefined();
  });
});