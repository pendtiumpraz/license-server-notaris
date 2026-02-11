export async function sendPiracyAlert(data: {
    licenseKey: string;
    holderName: string;
    officeName: string | null;
    boundDomain: string;
    attemptedDomain: string;
    attemptedIp: string;
    userAgent: string;
    attemptCount: number;
    timestamp: string;
}) {
    const webhookUrl = process.env.PIRACY_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        if (webhookUrl.includes('discord.com')) {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: '🚨 **PERINGATAN PEMBAJAKAN TERDETEKSI!**',
                    embeds: [{
                        color: 0xFF0000,
                        title: '⚠️ Percobaan Penggunaan License Ilegal',
                        fields: [
                            { name: '🔑 License', value: data.licenseKey, inline: true },
                            { name: '👤 Pemilik', value: data.holderName, inline: true },
                            { name: '🏢 Kantor', value: data.officeName || '-', inline: true },
                            { name: '✅ Domain Resmi', value: `\`${data.boundDomain}\``, inline: true },
                            { name: '❌ Domain Pembajak', value: `\`${data.attemptedDomain}\``, inline: true },
                            { name: '🌐 IP Pembajak', value: `\`${data.attemptedIp}\``, inline: true },
                            { name: '🔢 Percobaan ke-', value: `${data.attemptCount}`, inline: true },
                        ],
                        timestamp: data.timestamp,
                        footer: { text: 'Notaris License Server' },
                    }],
                }),
            });
        } else if (webhookUrl.includes('api.telegram.org')) {
            const text = `🚨 *PEMBAJAKAN TERDETEKSI!*\n\n` +
                `🔑 License: \`${data.licenseKey}\`\n` +
                `👤 Pemilik: ${data.holderName}\n` +
                `🏢 Kantor: ${data.officeName || '-'}\n` +
                `✅ Domain Resmi: \`${data.boundDomain}\`\n` +
                `❌ Domain Pembajak: \`${data.attemptedDomain}\`\n` +
                `🌐 IP: \`${data.attemptedIp}\`\n` +
                `🔢 Percobaan ke-${data.attemptCount}`;
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, parse_mode: 'Markdown' }),
            });
        } else {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'piracy_attempt', ...data }),
            });
        }
    } catch (e) {
        console.error('Failed to send piracy alert:', e);
    }
}

export function maskLicenseKey(key: string): string {
    const parts = key.split('-');
    if (parts.length >= 5) return `${parts[0]}-${parts[1]}-****-****-${parts[4]}`;
    return key.substring(0, 8) + '****';
}
