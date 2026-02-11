import { NextRequest, NextResponse } from 'next/server';
import { createSession, deleteSession, getSessionToken } from '@/lib/auth';

// POST /api/auth — Login
export async function POST(request: NextRequest) {
    const { username, password } = await request.json();
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';

    if (username === adminUser && password === adminPass) {
        const token = await createSession(username);
        const response = NextResponse.json({ success: true });
        response.cookies.set('session_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400, // 24h
            path: '/',
        });
        return response;
    }

    return NextResponse.json({ success: false, error: 'Username atau password salah' }, { status: 401 });
}

// DELETE /api/auth — Logout
export async function DELETE(request: NextRequest) {
    const token = request.cookies.get('session_token')?.value;
    if (token) deleteSession(token);
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    return response;
}

// GET /api/auth — Check session
export async function GET(request: NextRequest) {
    const token = await getSessionToken(request);
    if (token) return NextResponse.json({ valid: true });
    return NextResponse.json({ valid: false }, { status: 401 });
}
