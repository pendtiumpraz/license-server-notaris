import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/admin/stats
export async function GET(request: NextRequest) {
    const authError = requireAuth(request);
    if (authError) return authError;

    try {
        const [total, active, bound, totalPiracyAttempts] = await Promise.all([
            prisma.licenseKey.count(),
            prisma.licenseKey.count({ where: { isActive: true } }),
            prisma.licenseKey.count({ where: { boundDomain: { not: null } } }),
            prisma.licenseLog.count({ where: { isPiracy: true } }),
        ]);

        const byPackage = await prisma.licenseKey.groupBy({ by: ['packageType'], _count: true });

        const piracyHotspots = await prisma.licenseKey.findMany({
            where: { piracyAttempts: { gt: 0 } },
            orderBy: { piracyAttempts: 'desc' },
            take: 5,
            select: { key: true, holderName: true, officeName: true, piracyAttempts: true, lastPiracyAt: true },
        });

        return NextResponse.json({
            total, active, bound, totalPiracyAttempts,
            byPackage: byPackage.reduce((acc, i) => { acc[i.packageType] = i._count; return acc; }, {} as Record<string, number>),
            piracyHotspots,
        });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
