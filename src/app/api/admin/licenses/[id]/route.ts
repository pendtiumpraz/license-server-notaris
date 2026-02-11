import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// PATCH /api/admin/licenses/[id] — Update license
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const allowedFields = ['isActive', 'expiresAt', 'notes', 'packageType', 'holderName', 'officeName', 'holderEmail', 'holderPhone', 'address'];

    try {
        const data: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                data[field] = field === 'expiresAt' ? (body[field] ? new Date(body[field]) : null) : body[field];
            }
        }

        const license = await prisma.licenseKey.update({ where: { id }, data });
        return NextResponse.json({ success: true, license });
    } catch {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

// DELETE /api/admin/licenses/[id] — Unbind domain
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authError = requireAuth(request);
    if (authError) return authError;

    const { id } = await params;

    try {
        const license = await prisma.licenseKey.update({
            where: { id },
            data: { boundDomain: null, serverHash: null, activatedAt: null },
        });

        await prisma.licenseLog.create({
            data: {
                licenseId: id,
                action: 'unbind',
                details: `Domain unbound by admin. Previous: ${license.boundDomain || 'none'}`,
                isPiracy: false,
            },
        });

        return NextResponse.json({ success: true, license });
    } catch {
        return NextResponse.json({ error: 'Failed to unbind' }, { status: 500 });
    }
}
