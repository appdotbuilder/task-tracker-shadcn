import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { verifyToken, extractTokenFromHeader, generateToken } from '../handlers/auth_middleware';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  name: 'Test User'
};

// Helper function to decode JWT payload for testing
function decodePayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  const payload = parts[1];
  // Add padding if needed
  const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
  const decodedPayload = Buffer.from(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  return JSON.parse(decodedPayload);
}

// Helper function to create an expired token for testing
function createExpiredToken(userId: number, email: string, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId,
    email,
    iat: now - 7200, // 2 hours ago
    exp: now - 3600  // 1 hour ago (expired)
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const data = `${encodedHeader}.${encodedPayload}`;
  
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${signature}`;
}

describe('auth_middleware', () => {
  beforeEach(async () => {
    await createDB();
    // Set test JWT secret
    process.env['JWT_SECRET'] = 'test_secret_key_for_jwt_signing';
  });

  afterEach(async () => {
    await resetDB();
    delete process.env['JWT_SECRET'];
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'abc123token';
      const header = `Bearer ${token}`;
      
      const result = extractTokenFromHeader(header);
      
      expect(result).toEqual(token);
    });

    it('should return null for missing header', () => {
      const result = extractTokenFromHeader(undefined);
      
      expect(result).toBeNull();
    });

    it('should return null for empty header', () => {
      const result = extractTokenFromHeader('');
      
      expect(result).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const result = extractTokenFromHeader('abc123token');
      
      expect(result).toBeNull();
    });

    it('should return empty string for malformed Bearer header', () => {
      const result = extractTokenFromHeader('Bearer ');
      
      expect(result).toEqual('');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date()
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toEqual('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should throw error when JWT_SECRET is missing', () => {
      delete process.env['JWT_SECRET'];
      
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(() => generateToken(user)).toThrow(/JWT_SECRET environment variable is not configured/i);
    });

    it('should include correct payload in token', () => {
      const user = {
        id: 42,
        email: 'payload@test.com',
        name: 'Payload User',
        created_at: new Date(),
        updated_at: new Date()
      };

      const token = generateToken(user);
      const decoded = decodePayload(token);

      expect(decoded.userId).toEqual(42);
      expect(decoded.email).toEqual('payload@test.com');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token and return user context', async () => {
      // Create test user in database
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const createdUser = users[0];

      // Generate token for this user
      const token = generateToken({
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        created_at: createdUser.created_at,
        updated_at: createdUser.updated_at
      });

      const result = await verifyToken(token);

      expect(result.user.id).toEqual(createdUser.id);
      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.name).toEqual('Test User');
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for invalid token signature', async () => {
      const invalidToken = 'invalid.token.signature';

      await expect(verifyToken(invalidToken)).rejects.toThrow(/Invalid token/i);
    });

    it('should throw error for expired token', async () => {
      // Create expired token
      const expiredToken = createExpiredToken(1, 'test@example.com', 'test_secret_key_for_jwt_signing');

      await expect(verifyToken(expiredToken)).rejects.toThrow(/Token expired/i);
    });

    it('should throw error for token with missing userId', async () => {
      // Create token without userId
      const header = { alg: 'HS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        email: 'test@example.com',
        iat: now,
        exp: now + 3600
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const data = `${encodedHeader}.${encodedPayload}`;
      
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test_secret_key_for_jwt_signing')
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const tokenWithoutUserId = `${data}.${signature}`;

      await expect(verifyToken(tokenWithoutUserId)).rejects.toThrow(/Invalid token payload/i);
    });

    it('should throw error for token with missing email', async () => {
      // Create token without email
      const header = { alg: 'HS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        userId: 1,
        iat: now,
        exp: now + 3600
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const data = `${encodedHeader}.${encodedPayload}`;
      
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test_secret_key_for_jwt_signing')
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const tokenWithoutEmail = `${data}.${signature}`;

      await expect(verifyToken(tokenWithoutEmail)).rejects.toThrow(/Invalid token payload/i);
    });

    it('should throw error when user not found in database', async () => {
      // Create token for non-existent user
      const header = { alg: 'HS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        userId: 9999,
        email: 'nonexistent@example.com',
        iat: now,
        exp: now + 3600
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const data = `${encodedHeader}.${encodedPayload}`;
      
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test_secret_key_for_jwt_signing')
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `${data}.${signature}`;

      await expect(verifyToken(token)).rejects.toThrow(/User not found/i);
    });

    it('should throw error when token email does not match database user', async () => {
      // Create test user in database
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const createdUser = users[0];

      // Create token with different email
      const header = { alg: 'HS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        userId: createdUser.id,
        email: 'different@example.com',
        iat: now,
        exp: now + 3600
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const data = `${encodedHeader}.${encodedPayload}`;
      
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test_secret_key_for_jwt_signing')
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `${data}.${signature}`;

      await expect(verifyToken(token)).rejects.toThrow(/Token user mismatch/i);
    });

    it('should throw error when JWT_SECRET is missing', async () => {
      delete process.env['JWT_SECRET'];
      
      const token = 'any.valid.token';

      await expect(verifyToken(token)).rejects.toThrow(/JWT_SECRET environment variable is not configured/i);
    });

    it('should handle malformed token format', async () => {
      const malformedToken = 'only.one';

      await expect(verifyToken(malformedToken)).rejects.toThrow(/Invalid token format/i);
    });

    it('should handle malformed JSON in token payload', async () => {
      // Create token with invalid JSON payload
      const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const invalidPayload = Buffer.from('invalid json').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const data = `${header}.${invalidPayload}`;
      
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test_secret_key_for_jwt_signing')
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const malformedToken = `${data}.${signature}`;

      await expect(verifyToken(malformedToken)).rejects.toThrow(/Invalid token payload/i);
    });

    it('should verify token created with generateToken function', async () => {
      // Create test user in database
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const createdUser = users[0];

      // Use generateToken to create token
      const userForToken = {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        created_at: createdUser.created_at,
        updated_at: createdUser.updated_at
      };

      const token = generateToken(userForToken);

      // Verify the generated token
      const result = await verifyToken(token);

      expect(result.user.id).toEqual(createdUser.id);
      expect(result.user.email).toEqual(createdUser.email);
      expect(result.user.name).toEqual(createdUser.name);
    });
  });
});