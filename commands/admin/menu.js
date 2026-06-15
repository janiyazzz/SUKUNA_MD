/**
 * .menu — SUKUNA MD main menu
 *
 * - Honors .setdesign (reads database.getMenuDesign + buildCaption from
 *   utils/menuDesigns). Falls back to the original PASQUA TECH layout if
 *   the design module fails for any reason.
 * - Sends the menu video as a REAL video (with audio). The previous
 *   version forced gifPlayback:true, which made WhatsApp render it as a
 *   silent GIF.
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const config         = require('../../config');
const commandLoader  = require('../../utils/commandLoader');
const database       = require('../../utils/database');
const { buildCaption } = require('../../utils/menuDesigns');
const { boldItalic } = require('../../utils/styleBox');

const VIDEO_PATH = path.join(__dirname, '..', '..', 'assets', 'menuvideo.mp4');
const IMAGE_PATH = path.join(__dirname, '..', '..', 'assets', 'menuthumb.jpg');

const CHANNEL_JID  = '120363424109748354@newsletter';
const CHANNEL_NAME = 'Sukuna MD Pasqua tech';

function buildChannelCtx() {
    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: CHANNEL_JID,
            newsletterName: CHANNEL_NAME,
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
    if (d) return `${d}d ${h}h ${m}m ${s}s`;
    return `${h}h ${m}m ${s}s`;
}

function fmtMB(bytes) {
    return Math.round(bytes / 1024 / 1024) + 'MB';
}

function pad2(n) { return String(n).padStart(2, '0'); }

const CATEGORY_LABELS = {
    owner:      'OWNER',
    admin:      'ADMIN',
    moderation: 'MODERATION',
    economy:    'ECONOMY',
    fun:        'FUN',
    media:      'MEDIA',
    ai:         'AI',
    utility:    'UTILITY',
    group:      'GROUP',
    general:    'GENERAL',
    unicode:    'UNICODE',
    '18plus':   '18PLUS',
    textmaker:  'TEXTMAKER',
};

const CATEGORY_ORDER = [
    'owner', 'admin', 'moderation', 'economy', 'fun', 'media',
    'ai', 'utility', 'group', 'general', 'unicode', '18plus', 'textmaker',
];

// ── Fallback caption (original PASQUA TECH layout) ──
function buildFallbackCaption(ctx) {
    const {
        senderNumber, ownerName, prefix, mode, uptime,
        ramUsed, ramTotal, cmdCount, version, date, time,
        sortedCategories, byCategory,
    } = ctx;

    const header =
`> ┏❐  ⌜ *SUKUNA MD*⌟  ❐ 
> ┃⭔ user    : @${senderNumber}
> ┃⭔ owner   : ${ownerName}
> ┃⭔ prefix  : ${prefix}
> ┃⭔ mode    : ${mode}
> ┃⭔ uptime  : ${uptime}
> ┃⭔ speed   : ultra fast
> ┃⭔ ram     : ${ramUsed} / ${ramTotal}
> ┃⭔ cmds    : ${cmdCount}
> ┃⭔ version : v${version}
> ┃⭔ date    : ${date}
> ┃⭔ time    : ${time}
> ┃⭔ status  : Online ✅
> ┃⭔ library : @crysnovax/baileys
> ┃⭔ credits : pasqua tech
> ┗❐`;

    let body = `\n\n> ┏❐  ⌜ *COMMANDS*⌟  ❐ \n`;
    for (const cat of sortedCategories) {
        const list = byCategory[cat];
        if (!list || !list.length) continue;
        const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
        body += `\n\n*━━ ${label} ━━*\n`;
        for (const n of [...list].sort()) body += `> ❐ ${n}\n`;
    }
    body += `\n> ┗❐ ┈┈┈┈┈┈┈┈┈┈✧\n> _𝙥𝙖𝙨𝙦𝙪𝙖 𝙢𝙙 · king of curses · ${cmdCount} commands_`;

    return header + body;
}

module.exports = {
    name: 'menu',
    aliases: ['help', 'list', 'commands'],
    description: 'Show the SUKUNA MD command menu',
    category: 'admin',

    async execute({ sock, msg, from, sender, reply, phoneNumber }) {
        // ── Loading shrine animation (sent first, then deleted just
        //    before the real menu is delivered). ──
        let loadingKey = null;
        try {
            const frames = [
                '⛧ 𝙇𝙤𝙖𝙙𝙞𝙣𝙜 𝙈𝙖𝙡𝙚𝙫𝙤𝙡𝙚𝙣𝙩 𝙎𝙝𝙧𝙞𝙣𝙚 ⛧\n\n  ▰▱▱▱▱',
                '⛧ 𝙇𝙤𝙖𝙙𝙞𝙣𝙜 𝙈𝙖𝙡𝙚𝙫𝙤𝙡𝙚𝙣𝙩 𝙎𝙝𝙧𝙞𝙣𝙚 ⛧\n\n  ▰▰▱▱▱',
                '⛧ 𝙇𝙤𝙖𝙙𝙞𝙣𝙜 𝙈𝙖𝙡𝙚𝙫𝙤𝙡𝙚𝙣𝙩 𝙎𝙝𝙧𝙞𝙣𝙚 ⛧\n\n  ▰▰▰▱▱',
                '⛧ 𝙇𝙤𝙖𝙙𝙞𝙣𝙜 𝙈𝙖𝙡𝙚𝙫𝙤𝙡𝙚𝙣𝙩 𝙎𝙝𝙧𝙞𝙣𝙚 ⛧\n\n  ▰▰▰▰▱',
                '⛧ 𝙇𝙤𝙖𝙙𝙞𝙣𝙜 𝙈𝙖𝙡𝙚𝙫𝙤𝙡𝙚𝙣𝙩 𝙎𝙝𝙧𝙞𝙣𝙚 ⛧\n\n  ▰▰▰▰▰',
            ];
            const sent = await sock.sendMessage(from, { text: frames[0] }, { quoted: msg });
            loadingKey = sent?.key || null;
            // Animate the progress bar in-place by editing the same message.
            for (let i = 1; i < frames.length; i++) {
                await new Promise(r => setTimeout(r, 350));
                try {
                    await sock.sendMessage(from, { text: frames[i], edit: loadingKey });
                } catch (_) { /* edit not supported — ignore */ }
            }
        } catch (e) {
            console.error('[menu] loading animation failed:', e.message);
        }

        const commands = commandLoader.commands || new Map();

        // Group commands by category (dedupe by name; aliases excluded).
        const byCategory = {};
        for (const [name, cmd] of commands.entries()) {
            const cat = (cmd.category || 'general').toLowerCase();
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(name);
        }
        for (const k of Object.keys(byCategory)) byCategory[k].sort();

        const seen = new Set(CATEGORY_ORDER);
        const sortedCategories = [
            ...CATEGORY_ORDER,
            ...Object.keys(byCategory).filter(c => !seen.has(c)),
        ].filter(c => byCategory[c]?.length);

        // Build identity / runtime info
        const senderJid    = sender || msg?.key?.participant || msg?.key?.remoteJid || '';
        const senderNumber = String(phoneNumber || senderJid).replace(/[^0-9]/g, '') || 'user';
        const ownerName    = (config.owner && config.owner.name) || 'PASQUA';
        const prefix       = config.prefix || '.';
        const mode         = (global.botMode || config.mode || 'private').toLowerCase();
        const version      = config.version || '3.0.0';

        const uptime = fmtUptime(process.uptime());
        const mem    = process.memoryUsage();
        const ramUsed  = fmtMB(mem.rss);
        const ramTotal = fmtMB(os.totalmem() > mem.rss * 4 ? mem.rss * 2.6 : os.totalmem());
        const cmdCount = commands.size;

        const now  = new Date();
        const date = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
        const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

        // Runtime status / platform (some designs reference these — without
        // them the rendered menu shows "undefined").
        const status   = 'Online ✅';
        const platform = `${os.platform()} ${os.arch()}`;
        const speed    = 'ultra fast';
        const library  = '@crysnovax/baileys';
        const credits  = 'pasqua tech';

        // ── Resolve current menu design ──
        let designKey = 'nor';
        try { designKey = (database.getMenuDesign(phoneNumber) || 'nor').toLowerCase(); }
        catch (_) {}

        const designCtx = {
            userTag:  `@${senderNumber}`,
            creator:  ownerName,
            mode,
            total:    cmdCount,
            uptime,
            prefix,
            version,
            ramUsed,
            ramTotal,
            date,
            time,
            status,
            platform,
            speed,
            library,
            credits,
            // common aliases used by various design templates
            user:        `@${senderNumber}`,
            owner:       ownerName,
            ownerName,
            cmdCount,
            commands:    cmdCount,
            ram:         `${ramUsed} / ${ramTotal}`,
            sortedCategories,
            byCategory,
            CATEGORY_LABELS,
            boldItalic,
        };

        let caption;
        try {
            caption = buildCaption(designKey, designCtx);
            if (!caption || typeof caption !== 'string') throw new Error('empty caption');
        } catch (e) {
            console.error('[menu] buildCaption failed, using fallback:', e.message);
            caption = buildFallbackCaption({
                senderNumber, ownerName, prefix, mode, uptime,
                ramUsed, ramTotal, cmdCount, version, date, time,
                sortedCategories, byCategory,
            });
        }

        // ===== Send (video > image > text) with newsletter forward ctx =====
        const ctx = buildChannelCtx();
        const mentions = senderJid ? [senderJid] : [];

        try {
            // Delete the loading shrine right before sending the menu.
            if (loadingKey) {
                try { await sock.sendMessage(from, { delete: loadingKey }); }
                catch (_) { /* ignore */ }
            }

            // Image takes priority if it has been explicitly set by owner.
            // Fall back to video, then plain text.
            if (fs.existsSync(IMAGE_PATH)) {
                return await sock.sendMessage(
                    from,
                    {
                        image: fs.readFileSync(IMAGE_PATH),
                        caption,
                        mentions,
                        contextInfo: ctx,
                    },
                    { quoted: msg }
                );
            }
            if (fs.existsSync(VIDEO_PATH)) {
                // NOTE: NO gifPlayback — that flag makes WhatsApp render the
                // video as a silent GIF. We want sound, so send it as a
                // normal video.
                return await sock.sendMessage(
                    from,
                    {
                        video:    fs.readFileSync(VIDEO_PATH),
                        mimetype: 'video/mp4',
                        caption,
                        mentions,
                        contextInfo: ctx,
                    },
                    { quoted: msg }
                );
            }
            return await sock.sendMessage(
                from,
                { text: caption, mentions, contextInfo: ctx },
                { quoted: msg }
            );
        } catch (e) {
            console.error('[menu] send failed:', e.message);
            return reply(caption);
        }
    },
};
