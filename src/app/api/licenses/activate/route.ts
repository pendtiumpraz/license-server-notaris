import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPiracyAlert, maskLicenseKey } from '@/lib/piracy';

// POST /api/licenses/activate
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { licenseKey, domain, serverHash } = body;
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!licenseKey || !domain) {
        return NextResponse.json({ success: false, error: 'License key dan domain harus diisi' }, { status: 400 });
    }

    try {
        const license = await prisma.licenseKey.findUnique({
            where: { key: licenseKey.trim().toUpperCase() },
        });

        if (!license) {
            return NextResponse.json({ success: false, error: 'License key tidak ditemukan' }, { status: 404 });
        }

        if (!license.isActive) {
            await logAction(license.id, 'reject', domain, serverHash, clientIp, userAgent, 'Key deactivated', false);
            return NextResponse.json({ success: false, error: 'License key sudah tidak aktif' }, { status: 403 });
        }

        if (license.expiresAt && new Date() > license.expiresAt) {
            await logAction(license.id, 'reject', domain, serverHash, clientIp, userAgent, 'Key expired', false);
            return NextResponse.json({ success: false, error: 'License key sudah kedaluwarsa' }, { status: 403 });
        }

        // ====== PIRACY CHECK ======
        if (license.boundDomain && license.boundDomain !== domain) {
            const piracyCount = license.piracyAttempts + 1;

            await prisma.licenseKey.update({
                where: { id: license.id },
                data: { piracyAttempts: piracyCount, lastPiracyAt: new Date() },
            });

            await logAction(license.id, 'piracy_attempt', domain, serverHash, clientIp, userAgent,
                `⚠️ PEMBAJAKAN! Key "${license.holderName}" (${license.officeName || '-'}) bound ke ${license.boundDomain}, dicoba dari ${domain}. IP: ${clientIp}. Ke-${piracyCount}.`,
                true);

            await sendPiracyAlert({
                licenseKey: maskLicenseKey(license.key),
                holderName: license.holderName,
                officeName: license.officeName,
                boundDomain: license.boundDomain,
                attemptedDomain: domain,
                attemptedIp: clientIp,
                userAgent,
                attemptCount: piracyCount,
                timestamp: new Date().toISOString(),
            });

            return NextResponse.json({
                success: false,
                error: 'License key sudah terikat ke domain lain. Percobaan ini telah dicatat.',
            }, { status: 403 });
        }

        // Bind to domain
        const now = new Date();
        const updated = await prisma.licenseKey.update({
            where: { id: license.id },
            data: {
                boundDomain: domain,
                serverHash: serverHash || null,
                activatedAt: license.activatedAt || now,
                lastVerified: now,
            },
        });

        await logAction(license.id, 'activate', domain, serverHash, clientIp, userAgent,
            `Aktivasi OK. Pemilik: ${license.holderName} (${license.officeName || '-'})`, false);

        return NextResponse.json({
            success: true,
            license: {
                key: license.key,
                packageType: license.packageType,
                holderName: license.holderName,
                officeName: license.officeName,
                domain,
                expiresAt: license.expiresAt?.toISOString() || null,
                activatedAt: (updated.activatedAt || now).toISOString(),
            },
        });
    } catch (error) {
        console.error('Activation error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

async function logAction(
    licenseId: string, action: string, domain: string | null, serverHash: string | null,
    ip: string, userAgent: string, details: string, isPiracy: boolean
) {
    try {
        await prisma.licenseLog.create({
            data: { licenseId, action, domain, serverHash, ip, userAgent, details, isPiracy },
        });
    } catch (e) {
        console.error('Log error:', e);
    }
}
