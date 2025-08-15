import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login } from '../handlers/login';
import { createHash } from 'crypto';

// Helper function to hash password (matching the login handler)
const hashPassword = (password: string): string => {
  return createHash('sha256').update(password).digest('hex');
};

// Helper function to parse our simple JWT-like token
const parseToken = (token: string): any => {
  const [header, payload, signature] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
};

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User'
};

const loginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('login', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate user with valid credentials', async () => {
    // Create test user with hashed password
    const hashedPassword = hashPassword(testUser.password);
    const insertResult = await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: hashedPassword,
        name: testUser.name
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Test login
    const result = await login(loginInput);

    // Validate user data
    expect(result.user.id).toEqual(createdUser.id);
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.name).toEqual(testUser.name);
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);

    // Validate token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.split('.')).toHaveLength(3); // JWT format: header.payload.signature

    // Verify token payload
    const decoded = parseToken(result.token);
    expect(decoded.userId).toEqual(createdUser.id);
    expect(decoded.email).toEqual(testUser.email);
    expect(decoded.exp).toBeDefined(); // Token should have expiration
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000)); // Should expire in the future
  });

  it('should throw error for non-existent email', async () => {
    const invalidInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for incorrect password', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: hashedPassword,
        name: testUser.name
      })
      .execute();

    const invalidInput: LoginInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should not include password_hash in response', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: hashedPassword,
        name: testUser.name
      })
      .execute();

    const result = await login(loginInput);

    // Ensure password_hash is not in the response
    expect((result.user as any).password_hash).toBeUndefined();
    expect(Object.keys(result.user)).not.toContain('password_hash');
  });

  it('should generate unique tokens for different logins', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: hashedPassword,
        name: testUser.name
      })
      .execute();

    // Login twice
    const result1 = await login(loginInput);
    const result2 = await login(loginInput);

    // Tokens should be different (due to random component)
    expect(result1.token).not.toEqual(result2.token);
    
    // Both tokens should have valid payloads
    const decoded1 = parseToken(result1.token);
    const decoded2 = parseToken(result2.token);
    
    expect(decoded1.userId).toEqual(decoded2.userId);
    expect(decoded1.email).toEqual(decoded2.email);
    
    // Both should have expiration times
    expect(decoded1.exp).toBeDefined();
    expect(decoded2.exp).toBeDefined();
    expect(decoded1.iat).toBeDefined();
    expect(decoded2.iat).toBeDefined();
    
    // IAT (issued at) should be different due to randomness
    expect(decoded1.iat).not.toEqual(decoded2.iat);
  });

  it('should handle empty database gracefully', async () => {
    // Ensure database is empty (no users created in this test)
    const emptyInput: LoginInput = {
      email: 'empty@test.com',
      password: 'anypassword'
    };
    
    await expect(login(emptyInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should validate token format is correct', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        password_hash: hashedPassword,
        name: testUser.name
      })
      .execute();

    const result = await login(loginInput);
    const tokenParts = result.token.split('.');
    
    // Should have 3 parts: header.payload.signature
    expect(tokenParts).toHaveLength(3);
    
    // Each part should be base64url encoded
    expect(tokenParts[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenParts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenParts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should verify database state between tests', async () => {
    // This test checks that database is properly reset between tests
    const users = await db.select().from(usersTable).execute();
    expect(users).toHaveLength(0);
    
    // Create a user
    const hashedPassword = hashPassword('testpass');
    await db.insert(usersTable)
      .values({
        email: 'isolation-test@example.com',
        password_hash: hashedPassword,
        name: 'Isolation Test'
      })
      .execute();

    const usersAfterInsert = await db.select().from(usersTable).execute();
    expect(usersAfterInsert).toHaveLength(1);
  });
});