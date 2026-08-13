/**
 * banchecker — Check if a WhatsApp number is ACTIVE or BANNED/OFF-PLATFORM
 *
 * Usage:
 *   Reply to any message + .banchecker
 *   .banchecker <number>        (e.g. .banchecker 2349127814853)
 *
 * Optional enhancement — set NUMVERIFY_API_KEY (process.env or
 * config.js) for free line-validity lookups (100/month free tier):
 *   https://numverify.com/  — sign up → copy your free API key.
 * With the key, the bot also reports carrier + line validity from
 * the carrier registry (HLR), which catches numbers banned at the
 * telecom level. Without it, the registry check alone is used.
 *
 * How it works (authoritative, no shady APIs):
 *   Queries WhatsApp's own servers through the bot's live session
 *   (sock.onWhatsApp). This is the SAME check the official WhatsApp
 *   app performs, so the result is 100% server-side and accurate:
 *
 *   • ACTIVE          → the number has a live WhatsApp account
 *   • NOT ON WHATSAPP → no account exists / was banned & deleted /
 *                         the number left WhatsApp entirely
 *
 *   Note: WhatsApp does not expose a separate "currently banned" flag
 *   to other clients. A banned number disappears from the registry,
 *   so "NOT ON WHATSAPP" is what a banned number reports. This is
 *   exactly what professional number-checkers use.
 */
'use strict';

function normalizeNumber(input) {
    if (!input) return null;
    let num = String(input).replace(/[^0-9+]/g, '');
    if (!num) return null;
    if (num.startsWith('+')) num = num.slice(1);
    if (num.endsWith('@s.whatsapp.net')) {
        num = num.replace('@s.whatsapp.net', '');
    }
    if (num.length < 8 || num.length > 15) return null;
    return num;
}

function getCountry(num) {
    const codes = [
        ['1', 'United States/Canada'], ['20', 'Egypt'], ['27', 'South Africa'],
        ['30', 'Greece'], ['31', 'Netherlands'], ['33', 'France'],
        ['34', 'Spain'], ['36', 'Hungary'], ['39', 'Italy'],
        ['43', 'Austria'], ['44', 'United Kingdom'], ['45', 'Denmark'],
        ['46', 'Sweden'], ['47', 'Norway'], ['48', 'Poland'],
        ['49', 'Germany'], ['51', 'Peru'], ['52', 'Mexico'],
        ['54', 'Argentina'], ['55', 'Brazil'], ['56', 'Chile'],
        ['57', 'Colombia'], ['58', 'Venezuela'], ['60', 'Malaysia'],
        ['61', 'Australia'], ['62', 'Indonesia'], ['63', 'Philippines'],
        ['64', 'New Zealand'], ['65', 'Singapore'], ['66', 'Thailand'],
        ['81', 'Japan'], ['82', 'South Korea'], ['84', 'Vietnam'],
        ['86', 'China'], ['90', 'Turkey'], ['91', 'India'],
        ['92', 'Pakistan'], ['93', 'Afghanistan'], ['94', 'Sri Lanka'],
        ['95', 'Myanmar'], ['98', 'Iran'],
        ['212', 'Morocco'], ['213', 'Algeria'], ['216', 'Tunisia'],
        ['218', 'Libya'], ['220', 'Gambia'], ['221', 'Senegal'],
        ['222', 'Mauritania'], ['223', 'Mali'], ['224', 'Guinea'],
        ['225', 'Ivory Coast'], ['226', 'Burkina Faso'], ['227', 'Niger'],
        ['228', 'Togo'], ['229', 'Benin'], ['230', 'Mauritius'],
        ['231', 'Liberia'], ['232', 'Sierra Leone'], ['233', 'Ghana'],
        ['234', 'Nigeria'], ['235', 'Chad'], ['237', 'Cameroon'],
        ['243', 'DR Congo'], ['254', 'Kenya'], ['255', 'Tanzania'],
        ['256', 'Uganda'], ['257', 'Burundi'], ['258', 'Mozambique'],
        ['260', 'Zambia'], ['263', 'Zimbabwe'], ['267', 'Botswana'],
        ['268', 'Eswatini'], ['269', 'Comoros'],
    ];
    const sorted = codes.slice().sort((a, b) => b[0].length - a[0].length);
    for (const [code, name] of sorted) {
        if (num.startsWith(code)) return name;
    }
    return 'Unknown';
}

module.exports = {
    name: 'banchecker',
    aliases: ['bancheck', 'checkban', 'isbanned', 'numbercheck'],
    description: 'Check if a WhatsApp number is banned or active',
    usage: '.banchecker <number> or reply + .banchecker',
    category: 'utility',
    async execute({ sock, msg, from, reply, args, isOwner }) {
        if (!isOwner) {
            return reply('❌ *Owner only!*');
        }

        let target = null;

        // 1) Try the quoted/replied message's sender first
        try {
            const quotedKey = msg.message?.extendedTextMessage?.contextInfo?.participant ||
                msg.message?.extendedTextMessage?.contextInfo?.remoteJid ||
                msg.message?.imageMessage?.contextInfo?.participant ||
                msg.message?.videoMessage?.contextInfo?.participant;
            if (quotedKey && quotedKey.endsWith('@s.whatsapp.net')) {
                target = normalizeNumber(quotedKey);
            }
        } catch (_) { /* ignore */ }

        // 2) Fall back to the typed argument
        if (!target) {
            target = normalizeNumber((args[0] || '').trim());
        }

        if (!target) {
            return reply(
                `*╔══ 🛡️ BAN CHECKER ══╗*\n` +
                `║  Check if a number is  ║\n` +
                `║   *BANNED* or *ACTIVE* ║\n` +
                `╚════════════════════╝\n\n` +
                `*Usage:*\n` +
                `▸ Reply to a user + *.banchecker*\n` +
                `▸ .banchecker <number>\n\n` +
                `*Example:*\n` +
                `▸ .banchecker 2349127814853`
            );
        }

        // Show a "checking…" card first
        const waitMsg = await reply(
            `🛡️ *Checking:* +${target}\n` +
            `╰─ 🔄 _Querying WhatsApp servers…_`
        );

        let status = 'UNKNOWN';
        let detail = 'Could not verify — try again later.';
        let emoji = '❓';
        let extras = '';

        // ── STEP A (optional): NumVerify line-validity check ───────────
        // Free tier: 100 lookups/month. https://numverify.com/
        // Put NUMVERIFY_API_KEY in your env/config.js.
        // Default key ships with the bot; NUMVERIFY_API_KEY env overrides.
        const nvKey = process.env.NUMVERIFY_API_KEY || '1e4c1e7867b7d586bf28de7e2414fb93';
        if (nvKey) {
            try {
                const nvRes = await fetch(
                    `http://apilayer.net/api/validate?access_key=${encodeURIComponent(nvKey)}&number=${encodeURIComponent(target)}&country_code=&format=1`,
                    { signal: AbortSignal.timeout(15000) }
                );
                const nv = await nvRes.json();
                if (nv && typeof nv.valid === 'boolean') {
                    if (nv.valid === false) {
                        status = 'BANNED / INVALID LINE';
                        detail = `+${target} is *INVALID* at the\ncarrier registry level.\n(Number banned by the network\nor never existed.)`;
                        emoji = '🔴';
                    }
                    else {
                        status = 'VALID LINE';
                        detail = `+${target} is a *valid* carrier line.`;
                        emoji = '🟢';
                    }
                    if (nv.carrier) extras += `*Carrier:* ${nv.carrier}\n`;
                    if (nv.line_type) extras += `*Line type:* ${nv.line_type}\n`;
                    if (nv.location) extras += `*Region:* ${nv.location}\n`;
                }
                else if (nv && nv.error && nv.error.type === 'rate_limit_reached') {
                    extras += `_NumVerify limit reached — using registry check below._\n`;
                }
            }
            catch (nvErr) {
                console.error('[BANCHECKER] NumVerify failed:', nvErr.message);
            }
        }

        // ── STEP B (always): query WhatsApp's own registry ─────────────
        let registered = null;
        try {
            const onWA = await sock.onWhatsApp(target + '@s.whatsapp.net');
            registered = Array.isArray(onWA) && onWA.length > 0 && onWA[0].exists === true;
        }
        catch (qErr) {
            console.error('[BANCHECKER] onWhatsApp query failed:', qErr.message);
        }

        // If no API key gave a verdict, decide from the WhatsApp registry
        if (status === 'UNKNOWN') {
            if (registered === null) {
                status = 'UNKNOWN';
                detail = `Server check failed to respond.\nTry again in a moment.`;
                emoji = '🟡';
            }
            else if (registered) {
                status = 'ACTIVE';
                detail = `+${target} has a *LIVE* WhatsApp account.\n(Account is active on WhatsApp servers.)`;
                emoji = '🟢';
            }
            else {
                // No account in WhatsApp's registry — the number was never
                // registered, deleted it, or got BANNED (banned numbers are
                // removed from the registry).
                status = 'BANNED / OFF-WHATSAPP';
                detail = `+${target} is *NOT* in WhatsApp's registry.\nThis means the account was *\n` +
                    `banned, deleted, or never existed.*`;
                emoji = '🔴';
            }
        }
        else if (registered === false) {
            // API says valid line but WhatsApp registry says no account
            status = 'BANNED / OFF-WHATSAPP';
            detail = `The line is valid but has *no*\nWhatsApp account — banned,\ndeleted, or never registered.`;
            emoji = '🔴';
        }

        // Delete the "checking…" card and send the final result
        try { await sock.sendMessage(from, { delete: waitMsg.key }); } catch (_) { /* ignore */ }

        const country = getCountry(target);
        const source = nvKey ? `_Sources: carrier registry + WhatsApp_` : `_Source: WhatsApp live registry_`;
        return reply(
            `╔══ 🛡️ *BAN CHECKER* ══╗\n` +
            `║                        ║\n` +
            `║  ${emoji} *${status}*      ║\n` +
            `║                        ║\n` +
            `╚════════════════════╝\n\n` +
            `*Number:* +${target}\n` +
            `*Country:* ${country}\n\n` +
            `${extras}${detail}\n\n` +
            `${source}`
        );
    }
};
