/**
 * Generate License Key via CLI
 * 
 * Usage:
 *   npm run generate-key -- --package complete --holder "Budi, S.H." --office "Kantor Notaris Budi" --phone "081234"
 *   npm run generate-key -- --package no_ai --holder "Siti, S.H." --email "siti@email.com"
 *   npm run generate-key -- --package complete --holder "Batch" --count 5
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

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

async function main() {
    const args = process.argv.slice(2);
    const getArg = (name: string) => {
        const idx = args.indexOf(`--${name}`);
        return idx !== -1 ? args[idx + 1] : undefined;
    };

    const packageType = getArg('package') || 'complete';
    const holderName = getArg('holder') || 'Unknown';
    const officeName = getArg('office');
    const holderEmail = getArg('email');
    const holderPhone = getArg('phone');
    const address = getArg('address');
    const expiresStr = getArg('expires');
    const count = parseInt(getArg('count') || '1');

    console.log(`\n🔑 Generating ${count} license key(s)...\n`);
    console.log(`   Package: ${packageType} | Holder: ${holderName}${officeName ? ` | Office: ${officeName}` : ''}\n`);

    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
        const key = generateLicenseKey();
        await prisma.licenseKey.create({
            data: {
                key, packageType, holderName,
                officeName: officeName || null,
                holderEmail: holderEmail || null,
                holderPhone: holderPhone || null,
                address: address || null,
                expiresAt: expiresStr ? new Date(expiresStr) : null,
            },
        });
        keys.push(key);
        console.log(`   ✅ ${key}`);
    }

    console.log(`\n📋 Done! ${keys.length} key(s) created.\n`);
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
