import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

function generateLicenseKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments = [];
    for (let i = 0; i < 4; i++) {
        let s = '';
        for (let j = 0; j < 4; j++) s += chars[Math.floor(Math.random() * chars.length)];
        segments.push(s);
    }
    return `NTRS-${segments.join('-')}`;
}

// GET /api/admin/licenses — List all
export async function GET(request: NextRequest) {
    const authError = await requireAuth(request);
    if (authError) return authError;

    try {
        const licenses = await prisma.licenseKey.findMany({
            orderBy: { createdAt: 'desc' },
            include: { activationLogs: { orderBy: { createdAt: 'desc' }, take: 3 } },
        });
        return NextResponse.json({ licenses });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

// POST /api/admin/licenses — Create new
export async function POST(request: NextRequest) {
    const authError = await requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { packageType, holderName, officeName, holderEmail, holderPhone, address, boundDomain, expiresAt, notes } = body;

    if (!packageType || !holderName) {
        return NextResponse.json({ error: 'packageType dan holderName harus diisi' }, { status: 400 });
    }

    const validPackages = ['complete', 'no_ai', 'limited_ai'];
    if (!validPackages.includes(packageType)) {
        return NextResponse.json({ error: 'Package type tidak valid' }, { status: 400 });
    }

    try {
        const license = await prisma.licenseKey.create({
            data: {
                key: generateLicenseKey(),
                packageType,
                holderName,
                officeName: officeName || null,
                holderEmail: holderEmail || null,
                holderPhone: holderPhone || null,
                address: address || null,
                boundDomain: boundDomain || null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                notes: notes || null,
            },
        });
        return NextResponse.json({ success: true, license });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
}
