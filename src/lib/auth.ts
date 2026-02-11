import { SignJWT, jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

const JWT_SECRET_KEY = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret';

function getJwtSecret() {
    return new TextEncoder().encode(JWT_SECRET_KEY);
}

/**
 * Create a JWT session token (stateless, survives serverless cold starts)
 */
export async function createSession(username: string): Promise<string> {
    const token = await new SignJWT({ username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getJwtSecret());
    return token;
}

/**
 * Validate a JWT session token
 */
export async function validateSession(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
        await jwtVerify(token, getJwtSecret());
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete session — with JWT this is a no-op (token expires naturally)
 * Client side should delete the cookie
 */
export function deleteSession(_token: string): void {
    // JWT is stateless, no server-side cleanup needed
}

/**
 * Validate API_SECRET for server-to-server auth
 */
export function validateApiSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.API_SECRET;
    if (!apiSecret) return false;
    return authHeader === `Bearer ${apiSecret}`;
}

/**
 * Get and validate session token from cookie or Authorization header
 */
export async function getSessionToken(request: NextRequest): Promise<string | undefined> {
    // Check cookie first (dashboard), then Authorization header (API)
    const cookieToken = request.cookies.get('session_token')?.value;
    if (cookieToken && await validateSession(cookieToken)) return cookieToken;

    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    if (authHeader && await validateSession(authHeader)) return authHeader;

    return undefined;
}

/**
 * Middleware-style auth check. Returns null if authorized, or a 401 response.
 */
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
    // Allow API_SECRET auth
    if (validateApiSecret(request)) return null;

    // Allow session auth (JWT)
    const token = await getSessionToken(request);
    if (token) return null;

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
