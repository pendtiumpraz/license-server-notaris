import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/piracy
export async function GET(request: NextRequest) {
    const authError = requireAuth(request);
    if (authError) return authError;

    try {
        const piracyLogs = await prisma.licenseLog.findMany({
            where: { isPiracy: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                license: {
                    select: { key: true, holderName: true, officeName: true, holderPhone: true, boundDomain: true, piracyAttempts: true },
                },
            },
        });

        const suspiciousLicenses = await prisma.licenseKey.findMany({
            where: { piracyAttempts: { gt: 0 } },
            orderBy: { piracyAttempts: 'desc' },
            select: {
                id: true, key: true, holderName: true, officeName: true, holderPhone: true,
                boundDomain: true, piracyAttempts: true, lastPiracyAt: true, isActive: true,
            },
        });

        return NextResponse.json({ piracyLogs, suspiciousLicenses });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
