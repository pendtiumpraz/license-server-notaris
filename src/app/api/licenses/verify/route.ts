import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/licenses/verify
export async function POST(request: NextRequest) {
    const { licenseKey, domain, serverHash } = await request.json();
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!licenseKey || !domain) {
        return NextResponse.json({ valid: false, error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const license = await prisma.licenseKey.findUnique({
            where: { key: licenseKey.trim().toUpperCase() },
        });

        if (!license) return NextResponse.json({ valid: false, error: 'License tidak ditemukan' });
        if (!license.isActive) return NextResponse.json({ valid: false, error: 'License tidak aktif' });
        if (license.expiresAt && new Date() > license.expiresAt) {
            return NextResponse.json({ valid: false, error: 'License kedaluwarsa' });
        }

        if (license.boundDomain && license.boundDomain !== domain) {
            await prisma.licenseKey.update({
                where: { id: license.id },
                data: { piracyAttempts: { increment: 1 }, lastPiracyAt: new Date() },
            });
            await prisma.licenseLog.create({
                data: {
                    licenseId: license.id, action: 'piracy_attempt', domain, serverHash,
                    ip: clientIp, userAgent,
                    details: `Verify domain mismatch. Bound: ${license.boundDomain}, Tried: ${domain}`,
                    isPiracy: true,
                },
            });
            return NextResponse.json({ valid: false, error: 'Domain tidak cocok' });
        }

        await prisma.licenseKey.update({
            where: { id: license.id },
            data: { lastVerified: new Date() },
        });

        return NextResponse.json({
            valid: true,
            packageType: license.packageType,
            expiresAt: license.expiresAt?.toISOString() || null,
        });
    } catch (error) {
        console.error('Verify error:', error);
        return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
    }
}
