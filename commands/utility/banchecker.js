/**
 * banchecker — Accurate WhatsApp ban-status checker (2-factor detection)
 *
 * Usage:
 *   Reply to any message + .banchecker
 *   .banchecker <number>        (e.g. .banchecker 2349127814853)
 *
 * HOW THE ACCURATE CHECK WORKS (tested live against WhatsApp servers):
 *   Factor A — WhatsApp live registry  (sock.onWhatsApp)
 *       Does the number have an account record on WhatsApp's servers?
 *   Factor B — WhatsApp public send-page marker
 *       GET https://api.whatsapp.com/send?phone=<num>
 *       • ACTIVE account → og:title = the account's DISPLAY NAME
 *       • BANNED account → og:title = generic "Share on WhatsApp"
 *         (banned accounts stay in the registry but their profile
 *          is stripped from public pages)
 *
 *   Combining both factors:
 *       registry=HAS  +  name visible     → 🟢 ACTIVE
 *       registry=HAS  +  generic title    → 🔴 BANNED
 *       registry=NONE +  generic title    → 🔴 OFF-WHATSAPP
 *
 * Optional carrier-level check via NumVerify (free 100/month):
 *   https://numverify.com/ — default key ships with the bot;
 *   NUMVERIFY_API_KEY env var overrides it.
 */
'use strict';

const DEFAULT_NV_KEY = '1e4c1e7867b7d586bf28de7e2414fb93';

// ── Number parsing ───────────────────────────────────────────────────
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

// ── Country lookup ───────────────────────────────────────────────────
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

// ── Factor B: public send-page name probe ────────────────────────────
// Active account → og:title carries the display name.
// Banned/offline  → og:title is the generic "Share on WhatsApp".
async function probeSendPage(num) {
    try {
        const res = await fetch(
            `https://api.whatsapp.com/send?phone=${encodeURIComponent(num)}&type=phone_number&app_absent=0`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                signal: AbortSignal.timeout(15000),
            }
        );
        const html = await res.text();

        // Decode the title (WhatsApp encodes fancy fonts as HTML entities)
        const raw = ((html.match(/property="og:title" content="([^"]*)"/i) || [])[1] || '');
        const title = raw.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

        const generic = /share on whatsapp/i.test(title);
        return { ok: true, generic, title: generic ? null : title.trim() };
    }
    catch (_) {
        return { ok: false, generic: null, title: null };
    }
}

// ── Optional carrier check: NumVerify (default key + env override) ───
async function probeCarrier(num) {
    const nvKey = process.env.NUMVERIFY_API_KEY || DEFAULT_NV_KEY;
    try {
        const res = await fetch(
            `http://apilayer.net/api/validate?access_key=${encodeURIComponent(nvKey)}&number=${encodeURIComponent(num)}&country_code=&format=1`,
            { signal: AbortSignal.timeout(15000) }
        );
        const nv = await res.json();
        if (nv && typeof nv.valid === 'boolean') return { ok: true, data: nv };
        if (nv && nv.error && nv.error.type === 'rate_limit_reached') {
            return { ok: false, rateLimited: true };
        }
        return { ok: false };
    }
    catch (_) {
        return { ok: false };
    }
}

// ── Command ──────────────────────────────────────────────────────────
module.exports = {
    name: 'banchecker',
    aliases: ['bancheck', 'checkban', 'isbanned', 'numbercheck'],
    description: 'Accurately check if a WhatsApp number is banned or active',
    usage: '.banchecker <number> or reply + .banchecker',
    category: 'utility',
    async execute({ sock, msg, from, reply, args, isOwner }) {
        if (!isOwner) return reply('❌ *Owner only!*');

        // ── Determine the target number ──────────────────────────────
        let target = null;
        try {
            const ci =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo ||
                msg.message?.documentMessage?.contextInfo ||
                msg.message?.audioMessage?.contextInfo;
            const who = ci?.participant || ci?.remoteJid;
            if (who && who.endsWith('@s.whatsapp.net')) target = normalizeNumber(who);
        }
        catch (_) { /* ignore */ }

        if (!target) target = normalizeNumber((args[0] || '').trim());

        if (!target) {
            return reply(
                `*╔══ 🛡️ BAN CHECKER ══╗*\n` +
                `║  Accurate ban-status  ║\n` +
                `║     verification      ║\n` +
                `╚════════════════════╝\n\n` +
                `*Usage:*\n` +
                `▸ Reply to a user + *.banchecker*\n` +
                `▸ .banchecker <number>\n\n` +
                `*Example:*\n` +
                `▸ .banchecker 2349127814853`
            );
        }

        // ── Waiting card ─────────────────────────────────────────────
        const waitMsg = await reply(
            `🛡️ *Checking:* +${target}\n` +
            `╰─ 🔄 _Querying WhatsApp servers (2-factor)…_`
        );

        let result = null;

        // ── Factor A: live registry ──────────────────────────────────
        let registered = null;
        try {
            const onWA = await sock.onWhatsApp(target + '@s.whatsapp.net');
            registered = Array.isArray(onWA) && onWA.length > 0 && onWA[0].exists === true;
        }
        catch (_) { /* registry probe failed; continue with factor B */ }

        // ── Factor B: send-page marker ───────────────────────────────
        const page = await probeSendPage(target);

        // ── Optional Factor C: carrier registry ──────────────────────
        const carrier = await probeCarrier(target);

        // ── Verdict ──────────────────────────────────────────────────
        if (page.ok) {
            if (!page.generic && registered === true) {
                result = {
                    emoji: '🟢', status: 'UNBANNED — ACTIVE',
                    detail: `+${target} has a *LIVE* WhatsApp account.`,
                    profile: page.title,
                };
            }
            else if (page.generic && registered === true) {
                // Account still registered on the servers, but its public
                // profile is stripped — the classic signature of a ban.
                result = {
                    emoji: '🔴', status: 'BANNED',
                    detail: `+${target} is *banned on WhatsApp*.\n` +
                        `_Signature: account still in the server registry, but its public profile was stripped. Use "Request review" in-app._`,
                    profile: null,
                };
            }
            else if (page.generic && registered === false) {
                result = {
                    emoji: '🔴', status: 'OFF-WHATSAPP',
                    detail: `+${target} has *no* WhatsApp account.\n` +
                        `_Number was never registered, was deleted, or was banned & removed._`,
                    profile: null,
                };
            }
        }

        if (!result) {
            // Probes inconclusive — fall back to registry alone
            if (registered === true) {
                result = { emoji: '🟡', status: 'LIKELY ACTIVE', detail: `+${target} exists on WhatsApp's servers.`, profile: null };
            }
            else if (registered === false) {
                result = { emoji: '🔴', status: 'BANNED / OFF-WHATSAPP', detail: `+${target} is not on WhatsApp's servers.`, profile: null };
            }
            else {
                result = { emoji: '❓', status: 'UNKNOWN', detail: `Server probes failed. Try again in a moment.`, profile: null };
            }
        }

        // ── Carrier extras ───────────────────────────────────────────
        let extras = '';
        if (carrier.ok && carrier.data) {
            if (carrier.data.carrier) extras += `*Carrier:* ${carrier.data.carrier}\n`;
            if (carrier.data.line_type) extras += `*Line type:* ${carrier.data.line_type}\n`;
            if (carrier.data.country_name) extras += `*Region:* ${carrier.data.country_name}\n`;
        }
        else if (carrier.rateLimited) {
            extras += `_NumVerify limit reached — carrier info skipped._\n`;
        }

        // ── Send result ──────────────────────────────────────────────
        try { await sock.sendMessage(from, { delete: waitMsg.key }); } catch (_) { /* ignore */ }

        const country = getCountry(target);
        const profileLine = result.profile ? `*Profile name:* ${result.profile}\n` : '';
        return reply(
            `╔══ 🛡️ *BAN CHECKER* ══╗\n` +
            `║                        ║\n` +
            `║  ${result.emoji} *${result.status}*  ║\n` +
            `║                        ║\n` +
            `╚════════════════════╝\n\n` +
            `*Number:* +${target}\n` +
            `*Country:* ${country}\n` +
            profileLine +
            `${extras}\n` +
            `${result.detail}\n\n` +
            `_2-factor check: registry + public page_\n` +
            `_Note: exact ban reason/date is only visible_` +
            `_ inside the banned account itself._`
        );
    }
};
