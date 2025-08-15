import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type User } from '../schema';
import crypto from 'crypto';

export interface AuthContext {
    user: Omit<User, 'password_hash'>;
}

interface JwtPayload {
    userId: number;
    email: string;
    iat: number;
    exp: number;
}

// Simple JWT implementation without external dependencies
function base64UrlEncode(str: string): string {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
    // Add padding if needed
    str += '='.repeat((4 - str.length % 4) % 4);
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

function createSignature(data: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export function generateToken(user: Omit<User, 'password_hash'>): string {
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not configured');
    }

    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        iat: now,
        exp: now + (24 * 60 * 60) // 24 hours
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = createSignature(data, jwtSecret);

    return `${data}.${signature}`;
}

function verifySignature(token: string, secret: string): boolean {
    const parts = token.split('.');
    // Assume format is already validated by caller
    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;
    const expectedSignature = createSignature(data, secret);
    
    return signature === expectedSignature;
}

export async function verifyToken(token: string): Promise<AuthContext> {
    try {
        // Get JWT secret from environment
        const jwtSecret = process.env['JWT_SECRET'];
        if (!jwtSecret) {
            throw new Error('JWT_SECRET environment variable is not configured');
        }

        // Split token into parts and validate format first
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }

        // Verify signature
        if (!verifySignature(token, jwtSecret)) {
            throw new Error('Invalid token signature');
        }

        // Decode payload
        let payload: JwtPayload;
        try {
            const decodedPayload = base64UrlDecode(parts[1]);
            payload = JSON.parse(decodedPayload);
        } catch {
            throw new Error('Invalid token payload');
        }

        // Check required fields
        if (!payload.userId || !payload.email || !payload.exp || !payload.iat) {
            throw new Error('Invalid token payload');
        }

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            throw new Error('Token expired');
        }

        // Check if token is not before current time (iat check)
        if (payload.iat > now) {
            throw new Error('Token not active');
        }

        // Fetch user from database by ID
        const users = await db.select({
            id: usersTable.id,
            email: usersTable.email,
            name: usersTable.name,
            created_at: usersTable.created_at,
            updated_at: usersTable.updated_at
        })
        .from(usersTable)
        .where(eq(usersTable.id, payload.userId))
        .execute();

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];

        // Verify email matches token (additional security check)
        if (user.email !== payload.email) {
            throw new Error('Token user mismatch');
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        throw error;
    }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
    // Extract Bearer token from Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7); // Remove 'Bearer ' prefix
}