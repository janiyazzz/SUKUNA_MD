/**
 * Menu Command — Sukuna MD inline boutique menu
 *
 *  • Loading "Malevolent Shrine" placeholder edited into the final menu
 *  • Bold-italic Unicode headers + monospace box drawing
 *  • Auto-pulls categories from the live plugin registry
 *  • Sends the existing menuvideo.mp4 if available
 *  • "View Channel" pill (forwardedNewsletterMessageInfo) on the menu only
 *    — no externalAdReply anywhere
 */

const config        = require('../../config');
const commandLoader = require('../../utils/commandLoader');
const { boldItalic } = require('../../utils/styleBox');
const fs   = require('fs');
const path = require('path');

const VIDEO_PATH = path.resolve(__dirname, '..', '..', 'assets', 'menuvideo.mp4');

// ── OFFICIAL CHANNEL (View Channel pill on menu only) ─────────────
const CHANNEL_JID  = '120363424109748354@newsletter';
const CHANNEL_NAME = 'Sukuna MD Pasqua tech';

/**
 * Returns a contextInfo that renders the tappable "View Channel" pill
 * on the menu message. Contains ONLY forwardedNewsletterMessageInfo —
 * no externalAdReply.
 */
function buildChannelCtx() {
    return {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid:   CHANNEL_JID,
            newsletterName:  CHANNEL_NAME,
            serverMessageId: 143,
        },
    };
}

function fmtUptime(sec) {
    sec = Math.floor(sec);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m ${s}s`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
}

const CATEGORY_LABELS = {
    owner: 'Owner', admin: 'Admin', moderation: 'Moderation',
    economy: 'Economy', fun: 'Fun', media: 'Media', ai: 'AI',
    utility: 'Utility', group: 'Group', general: 'General', unicode: 'Unicode',
};
const CATEGORY_ORDER = ['owner','admin','moderation','economy','fun','media','ai','utility','group','general','unicode'];

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'list'],
    description: 'Show all available commands',
    category: 'admin',

    async execute({ sock, msg, from, sender, reply, phoneNumber }) {
        // ── 1. CLASSY LOADING SCREEN ───────────────────────────────────
        const loadingText =
            `⛧ ${boldItalic('Loading Malevolent Shrine')} ⛧\n` +
            `   ▰▱▱▱▱`;
        let placeholder = null;
        try {
            placeholder = await sock.sendMessage(from, { text: loadingText }, { quoted: msg });
        } catch (_) {}

        if (placeholder?.key) {
            const frames = ['▰▰▱▱▱', '▰▰▰▱▱', '▰▰▰▰▱', '▰▰▰▰▰'];
            for (const f of frames) {
                await new Promise(r => setTimeout(r, 140));
                try {
                    await sock.sendMessage(from, {
                        text: `⛧ ${boldItalic('Loading Malevolent Shrine')} ⛧\n   ${f}`,
                        edit: placeholder.key
                    });
                } catch (_) { break; }
            }
        }

        // ── 2. BUILD THE MENU ──────────────────────────────────────────
        const all = commandLoader.getAllCommands();
        const byCategory = {};
        for (const [name, cmd] of all) {
            const cat = cmd.category || 'general';
            (byCategory[cat] ||= []).push(name);
        }
        for (const c of Object.keys(byCategory)) byCategory[c].sort();

        const sortedCategories = [
            ...CATEGORY_ORDER.filter(c => byCategory[c]),
            ...Object.keys(byCategory).filter(c => !CATEGORY_ORDER.includes(c))
        ];

        const userTag = '@' + (sender || phoneNumber || '').split('@')[0].split(':')[0];
        const mode = (() => {
            try { return require('../../utils/database').getSelfMode(phoneNumber) ? 'private' : 'public'; }
            catch (_) { return 'public'; }
        })();
        const creator = config.owner?.name || 'Pasqua';

        // ── Pick design (per-session) ────────────────────────────────
        let designKey = 'nor';
        try { designKey = require('../../utils/database').getMenuDesign(phoneNumber) || 'nor'; }
        catch (_) {}

        const { buildCaption } = require('../../utils/menuDesigns');
        const caption = buildCaption(designKey, {
            userTag,
            creator,
            mode,
            total: all.size,
            uptime: fmtUptime(process.uptime()),
            prefix: config.prefix,
            version: config.version || '2.0.0',
            sortedCategories,
            byCategory,
            CATEGORY_LABELS,
            boldItalic,
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
            status: 'Online ✅',
            platform: 'Panel',
        });

        // View Channel pill contextInfo (no externalAdReply)
        const channelCtx = buildChannelCtx();

        // ── 3. SEND THE REAL MENU ──────────────────────────────────────
        // The View Channel pill does NOT propagate to other WhatsApp
        // users when applied via an `edit` payload, so we must always
        // send the final menu as a fresh message.
        if (placeholder?.key) {
            try { await sock.sendMessage(from, { delete: placeholder.key }); } catch (_) {}
        }

        // Send the menu as a video WITH caption and audio so users hear
        // the intro sound. Video also carries the View Channel pill for
        // the sender's own client.
        let videoSent = false;
        if (fs.existsSync(VIDEO_PATH)) {
            try {
                await sock.sendMessage(from, {
                    video:       { url: VIDEO_PATH },
                    caption,
                    gifPlayback: false,
                    mimetype:    'video/mp4',
                    contextInfo: channelCtx,
                }, { quoted: msg });
                videoSent = true;
            } catch (e) {
                console.error('[Menu] Video send failed:', e.message);
            }
        }

        // Some WhatsApp clients don't render the newsletter pill on
        // video messages for other viewers. Send a short follow-up text
        // carrying the pill so every user — sender or recipient — sees
        // the View Channel button (text messages render it reliably,
        // identical to how the repo command works).
        try {
            const tail = videoSent
                ? `📣 *Official Channel* — tap *View Channel* below to follow.`
                : caption;
            await sock.sendMessage(from, {
                text: tail,
                contextInfo: channelCtx,
            }, { quoted: msg });
        } catch (_) {
            if (!videoSent) await reply(caption);
        }
    }
};
