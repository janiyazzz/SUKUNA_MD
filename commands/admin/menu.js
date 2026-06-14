/**
 * .menu — SUKUNA MD main menu
 *
 * New PASQUA TECH design — this is now THE main design.
 * Sends the menu video/image (if configured) with the styled caption.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const commandLoader = require('../../utils/commandLoader');

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

module.exports = {
    name: 'menu',
    aliases: ['help', 'list', 'commands'],
    description: 'Show the SUKUNA MD command menu',
    category: 'admin',

    async execute({ sock, msg, from, sender, reply, phoneNumber }) {
        const commands = commandLoader.commands || new Map();

        // Group commands by category (dedupe by name; aliases excluded).
        const byCat = {};
        for (const [name, cmd] of commands.entries()) {
            const cat = (cmd.category || 'general').toLowerCase();
            if (!byCat[cat]) byCat[cat] = new Set();
            byCat[cat].add(name);
        }

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

        // ===== Header =====
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

        // ===== Commands list =====
        let body = `\n\n> ┏❐  ⌜ *COMMANDS*⌟  ❐ \n`;
        const seen = new Set(CATEGORY_ORDER);
        const allCats = [...CATEGORY_ORDER, ...Object.keys(byCat).filter(c => !seen.has(c))];

        for (const cat of allCats) {
            const set = byCat[cat];
            if (!set || !set.size) continue;
            const label = CATEGORY_LABELS[cat] || cat.toUpperCase();
            body += `\n\n*━━ ${label} ━━*\n`;
            const list = [...set].sort();
            for (const n of list) body += `> ❐ ${n}\n`;
        }

        body += `\n> ┗❐ ┈┈┈┈┈┈┈┈┈┈✧\n> _𝙥𝙖𝙨𝙦𝙪𝙖 𝙢𝙙 · king of curses · ${cmdCount} commands_`;

        const caption = header + body;

        // ===== Send (video > image > text) with newsletter forward ctx =====
        const ctx = buildChannelCtx();
        const mentions = senderJid ? [senderJid] : [];

        try {
            if (fs.existsSync(VIDEO_PATH)) {
                return await sock.sendMessage(
                    from,
                    {
                        video: fs.readFileSync(VIDEO_PATH),
                        caption,
                        mentions,
                        gifPlayback: true,
                        contextInfo: ctx,
                    },
                    { quoted: msg }
                );
            }
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
