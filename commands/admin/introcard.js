'use strict';
const { database } = require('../../utils/database');

module.exports = {
    name: 'introcard',
    aliases: ['intro', 'introset'],
    description: 'Beautiful intro card for new group members (shows group PP)',
    category: 'admin',

    async execute({ sock, msg, from, reply, args, isGroup, isAdmin, isBotAdmin }) {
        if (!isGroup) return reply('❌ This command is for groups only.');
        if (!isAdmin) return reply('❌ Only admins can configure the intro card.');

        const sub = (args[0] || '').toLowerCase();

        // ── .introcard on/off ──────────────────────────────────────────────
        if (sub === 'on') {
            database.setGroup(from, 'introcard', true);
            return reply(
                `╭─❒ ◈ 𝙎𝙐𝙆𝙐᳇𝘼 ❒\n` +
                `│ ✅ *Intro Card Enabled*\n` +
                `│ New members will get a beautiful intro card.\n` +
                `╰─⛧ 𝓹𝓪𝓼𝓺𝓾𝓪 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭`
            );
        }

        if (sub === 'off') {
            database.setGroup(from, 'introcard', false);
            return reply(
                `╭─❒ ◈ 𝙎𝙐𝙆𝙐᳇𝘼 ❒\n` +
                `│ ❌ *Intro Card Disabled*\n` +
                `╰─⛧ 𝓹𝓪𝓼𝓺𝓾𝓪 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭`
            );
        }

        // ── .introcard msg <text> ──────────────────────────────────────────
        if (sub === 'msg') {
            const customMsg = args.slice(1).join(' ').trim();
            if (!customMsg) return reply('❌ Please provide a message.\nUse @user and @group as placeholders.');
            database.setGroup(from, 'introcardMessage', customMsg);
            return reply(
                `╭─❒ ◈ 𝙎𝙐𝙆𝙐᳇𝘼 ❒\n` +
                `│ ✅ *Intro Message Set*\n` +
                `│ ${customMsg}\n` +
                `╰─⛧ 𝓹𝓪𝓼𝓺𝓾𝓪 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭`
            );
        }

        // ── .introcard title <text> ────────────────────────────────────────
        if (sub === 'title') {
            const title = args.slice(1).join(' ').trim();
            if (!title) return reply('❌ Please provide a title.');
            database.setGroup(from, 'introcardTitle', title);
            return reply(`✅ Intro card title set to: *${title}*`);
        }

        // ── .introcard color <light|dark|fire|ocean|royal> ────────────────
        if (sub === 'color' || sub === 'theme') {
            const theme = args[1]?.toLowerCase();
            const valid = ['light', 'dark', 'fire', 'ocean', 'royal'];
            if (!theme || !valid.includes(theme))
                return reply(`❌ Choose a theme: ${valid.join(', ')}`);
            database.setGroup(from, 'introcardTheme', theme);
            return reply(`✅ Intro card theme set to: *${theme}*`);
        }

        // ── .introcard reset ───────────────────────────────────────────────
        if (sub === 'reset') {
            database.setGroup(from, 'introcardMessage', null);
            database.setGroup(from, 'introcardTitle',   null);
            database.setGroup(from, 'introcardTheme',   null);
            return reply('✅ Intro card reset to defaults.');
        }

        // ── .introcard preview ─────────────────────────────────────────────
        if (sub === 'preview') {
            const grp  = database.getGroup(from);
            const meta = await sock.groupMetadata(from).catch(() => ({}));
            await sendIntroCard(sock, from, sock.user?.id || from, meta, grp);
            return;
        }

        // ── Show status / help ─────────────────────────────────────────────
        const grp = database.getGroup(from);
        return reply(
            `╭─❒ ◈ 𝙎𝙐𝙆𝙐᳇𝘼 — 𝗜𝗡𝗧𝗥𝗢 𝗖𝗔𝗥𝗗 ❒\n` +
            `│\n` +
            `│ 📌 *Status:* ${grp.introcard ? '✅ ON' : '❌ OFF'}\n` +
            `│ 🎨 *Theme:*  ${grp.introcardTheme || 'default'}\n` +
            `│ 📝 *Msg:*    ${grp.introcardMessage || 'default'}\n` +
            `│\n` +
            `│ ⚙️ *Commands:*\n` +
            `│ • .introcard on/off\n` +
            `│ • .introcard msg <text>  (@user @group)\n` +
            `│ • .introcard title <text>\n` +
            `│ • .introcard color <light|dark|fire|ocean|royal>\n` +
            `│ • .introcard preview\n` +
            `│ • .introcard reset\n` +
            `╰─⛧ 𝓹𝓪𝓼𝓺𝓾𝓪 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭`
        );
    },
};

// ─── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
    default: { top: '🌟', mid: '✦', star: '⭐', wave: '〰️', gem: '💎' },
    dark:    { top: '🖤', mid: '◆', star: '🌑', wave: '▬', gem: '🔮' },
    fire:    { top: '🔥', mid: '🌟', star: '💥', wave: '〰️', gem: '🏆' },
    ocean:   { top: '🌊', mid: '🐚', star: '💙', wave: '〰️', gem: '🐬' },
    royal:   { top: '👑', mid: '♦', star: '🌟', wave: '━', gem: '💍' },
    light:   { top: '☀️', mid: '✨', star: '🌸', wave: '〰️', gem: '🦋' },
};

// ─── Card builder ──────────────────────────────────────────────────────────────
function buildCard(participant, groupName, memberCount, grp) {
    const number = participant.split('@')[0];
    const t      = THEMES[grp.introcardTheme] || THEMES.default;
    const title  = grp.introcardTitle || `Welcome to ${groupName}`;
    const body   = grp.introcardMessage
        ? grp.introcardMessage.replace(/@user/g, `@${number}`).replace(/@group/g, groupName)
        : `Hey @${number}! 👋\nWe're so glad you joined us.\nIntroduce yourself to the family! 🎉`;

    const line = '━━━━━━━━━━━━━━━━━━━━━━━━';

    return (
        `${t.top}${t.top}${t.top} *${title.toUpperCase()}* ${t.top}${t.top}${t.top}\n` +
        `${line}\n` +
        `\n` +
        `${t.star} *NEW MEMBER* ${t.star}\n` +
        `👤 @${number}\n` +
        `\n` +
        `${line}\n` +
        `\n` +
        `${t.gem} *Group:* ${groupName}\n` +
        `👥 *Members:* ${memberCount}\n` +
        `\n` +
        `${line}\n` +
        `\n` +
        `${body}\n` +
        `\n` +
        `${line}\n` +
        `${t.mid} _𝙎𝙐𝙆𝙐᳇𝘼_ ${t.mid}  •  t.me/Pasquaking`
    );
}

// ─── Exported function — called by sessionManager on member join ───────────────
async function sendIntroCard(sock, groupId, participant, meta, grp) {
    try {
        const groupName   = meta?.subject || 'the group';
        const memberCount = meta?.participants?.length || 0;
        const caption     = buildCard(participant, groupName, memberCount, grp);
        const mentions    = [participant];

        // Use GROUP profile picture (not user's)
        let gpicUrl = null;
        try { gpicUrl = await sock.profilePictureUrl(groupId, 'image'); } catch (_) {}

        const opts = { mentions, contextInfo: { mentionedJid: mentions } };

        if (gpicUrl) {
            try {
                await sock.sendMessage(groupId, { image: { url: gpicUrl }, caption, ...opts });
                return;
            } catch (_) {}
        }
        await sock.sendMessage(groupId, { text: caption, ...opts });
    } catch (e) {
        console.error('[introcard] send failed:', e.message);
    }
}

module.exports.sendIntroCard = sendIntroCard;
