import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';

// In-memory sessions. For production, consider using a DB or JWT.
const sessions = new Map<string, { username: string; expiresAt: number }>();

export function createSession(username: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return token;
}

export function validateSession(token: string | undefined): boolean {
    if (!token) return false;
    const session = sessions.get(token);
    if (!session) return false;
    if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return false;
    }
    return true;
}

export function deleteSession(token: string): void {
    sessions.delete(token);
}

export function validateApiSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.API_SECRET;
    if (!apiSecret) return false;
    return authHeader === `Bearer ${apiSecret}`;
}

export function getSessionToken(request: NextRequest): string | undefined {
    // Check cookie first (dashboard), then Authorization header (API)
    const cookieToken = request.cookies.get('session_token')?.value;
    if (cookieToken && validateSession(cookieToken)) return cookieToken;

    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    if (authHeader && validateSession(authHeader)) return authHeader;

    return undefined;
}

export function requireAuth(request: NextRequest): NextResponse | null {
    // Allow API_SECRET auth
    if (validateApiSecret(request)) return null;

    // Allow session auth
    const token = getSessionToken(request);
    if (token) return null;

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
