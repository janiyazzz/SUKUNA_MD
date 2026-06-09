'use strict';
/**
 * eventManager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised handler for group participant events:
 *   • Welcome messages  (member joins)
 *   • Goodbye messages  (member leaves / is removed)
 *   • Intro cards       (member joins, when enabled)
 *
 * Used by:
 *   lib/sessionManager.js  — real-time event hook
 *   commands/admin/welcome.js  — .welcome test
 *   commands/admin/goodbye.js  — .goodbye test
 *   commands/admin/introcard.js — .introcard preview
 */

const database = require('../utils/database');

// ── Styling constants ─────────────────────────────────────────────────────────
const TITLE_BOLD    = '𝙎𝙐𝙆𝙐᳇𝘼';
const FOOTER_ITALIC = '𝓹𝓪𝓼𝓺𝓾𝓪 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭';
const DIVIDER       = '━━━━━━━━━━━━━━━━━━━━━';

// ── Intro card themes ─────────────────────────────────────────────────────────
const THEMES = {
    default: { top: '🌟', mid: '✦', star: '⭐', wave: '〰️', gem: '💎' },
    dark:    { top: '🖤', mid: '◆', star: '🌑', wave: '▬',  gem: '🔮' },
    fire:    { top: '🔥', mid: '🌟', star: '💥', wave: '〰️', gem: '🏆' },
    ocean:   { top: '🌊', mid: '🐚', star: '💙', wave: '〰️', gem: '🐬' },
    royal:   { top: '👑', mid: '♦',  star: '🌟', wave: '━',  gem: '💍' },
    light:   { top: '☀️', mid: '✨', star: '🌸', wave: '〰️', gem: '🦋' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _normJid(j) {
    return (j || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

async function _fetchPP(sock, jid) {
    try { return await sock.profilePictureUrl(jid, 'image'); } catch (_) { return null; }
}

async function _fetchMeta(sock, groupId) {
    try {
        return await Promise.race([
            sock.groupMetadata(groupId),
            new Promise((_, rej) => setTimeout(() => rej(new Error('meta timeout')), 4000)),
        ]);
    } catch (_) { return null; }
}

function _channelCtx() {
    try {
        const nb   = require('../utils/newsletterBrand');
        const pill = nb.CANONICAL_NEWSLETTER || {
            newsletterJid:   nb.NEWSLETTER_JID,
            newsletterName:  nb.NEWSLETTER_NAME,
            serverMessageId: 143,
        };
        return {
            isForwarded: true,
            forwardingScore: 999,
            forwardedNewsletterMessageInfo: pill,
        };
    } catch (_) { return {}; }
}

// ── Banner builder (welcome / goodbye) ───────────────────────────────────────

function buildBanner(kind, participant, groupName, memberCount, customMsg) {
    const number      = participant.split('@')[0];
    const userMention = `@${number}`;
    const action      = kind === 'welcome' ? 'Welcome to' : 'Goodbye from';
    const greeting    = kind === 'welcome' ? 'Hello'      : 'Farewell';
    const tail        = customMsg
        ? customMsg
            .replace(/@user/g,   userMention)
            .replace(/\{name\}/gi, userMention)
            .replace(/@group/g,  groupName)
            .replace(/\{group\}/gi, groupName)
            .replace(/\{count\}/gi, String(memberCount))
        : (kind === 'welcome' ? 'Welcome to the group!' : 'We will miss you!');

    return (
        `┏━〔 ✦ ${TITLE_BOLD} 〕━\n` +
        `❏┃ ${action} ${groupName}\n` +
        `❏┃ ${greeting} ${userMention}\n` +
        `❏┃ Members: ${memberCount}\n` +
        `❏┃ ${tail}\n` +
        `\n` +
        `${FOOTER_ITALIC}\n` +
        `${DIVIDER}`
    );
}

// ── Intro card builder ────────────────────────────────────────────────────────

function buildIntroCard(participant, groupName, memberCount, grp) {
    const number = participant.split('@')[0];
    const t      = THEMES[grp.introcardTheme] || THEMES.default;
    const title  = grp.introcardTitle || `Welcome to ${groupName}`;
    const body   = grp.introcardMessage
        ? grp.introcardMessage
            .replace(/@user/g,   `@${number}`)
            .replace(/\{name\}/gi, `@${number}`)
            .replace(/@group/g,  groupName)
            .replace(/\{group\}/gi, groupName)
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

// ── Public send helpers ───────────────────────────────────────────────────────

/**
 * Send a welcome or goodbye banner to the group.
 *
 * @param {object} sock        - Baileys socket
 * @param {string} groupId     - Group JID
 * @param {string} participant - Member JID
 * @param {'welcome'|'goodbye'} kind
 * @param {string} groupName
 * @param {number} memberCount
 * @param {string|null} customMsg
 */
async function sendBanner(sock, groupId, participant, kind, groupName, memberCount, customMsg) {
    const caption = buildBanner(kind, participant, groupName, memberCount, customMsg);
    const ctx     = _channelCtx();

    let ppUrl = null;
    try {
        ppUrl = await Promise.race([
            _fetchPP(sock, participant),
            new Promise(resolve => setTimeout(() => resolve(null), 4000)),
        ]);
    } catch (_) {}

    const opts = {
        mentions:    [participant],
        contextInfo: { ...ctx, mentionedJid: [participant] },
    };

    if (ppUrl) {
        try {
            await sock.sendMessage(groupId, { image: { url: ppUrl }, caption, ...opts });
            return;
        } catch (_) {}
    }
    await sock.sendMessage(groupId, { text: caption, ...opts });
}

/**
 * Send a styled intro card to the group.
 *
 * @param {object} sock
 * @param {string} groupId
 * @param {string} participant
 * @param {object|null} meta       - groupMetadata (optional, fetched if null)
 * @param {object|null} grp        - database group config (optional)
 */
async function sendIntroCard(sock, groupId, participant, meta, grp) {
    if (!meta) meta = await _fetchMeta(sock, groupId);
    if (!grp)  grp  = database.getGroup(groupId);

    const groupName   = meta?.subject || 'the group';
    const memberCount = meta?.participants?.length || 0;
    const caption     = buildIntroCard(participant, groupName, memberCount, grp);
    const mentions    = [participant];

    // Use GROUP profile picture for the intro card.
    let gpicUrl = null;
    try {
        gpicUrl = await Promise.race([
            sock.profilePictureUrl(groupId, 'image'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('pp timeout')), 4000)),
        ]);
    } catch (_) {}

    const opts = { mentions, contextInfo: { mentionedJid: mentions } };

    if (gpicUrl) {
        try {
            await sock.sendMessage(groupId, { image: { url: gpicUrl }, caption, ...opts });
            return;
        } catch (e) {
            console.warn('[eventManager] introcard image send failed, falling back to text:', e.message);
        }
    }
    await sock.sendMessage(groupId, { text: caption, ...opts });
}

// ── Core event handler ────────────────────────────────────────────────────────

/**
 * Handle a group-participants.update event.
 * Called by sessionManager and by command test/preview flows.
 *
 * @param {object} sock
 * @param {string} phoneNumber  - bot's phone number (unused here, kept for API compat)
 * @param {object} update       - { id, participants, action, author }
 */
async function handleGroupParticipantsEvent(sock, phoneNumber, { id, participants, action, author }) {
    try {
        const grp  = database.getGroup(id);
        const meta = await _fetchMeta(sock, id);

        const groupName   = meta?.subject || 'the group';
        const memberCount = meta?.participants?.length || 0;
        const botJid      = _normJid(sock.user?.id);

        // Never send welcome/goodbye to the bot itself.
        const safeParticipants = (participants || []).filter(p => _normJid(p) !== botJid);

        // ── Welcome ───────────────────────────────────────────────────
        if (action === 'add' && grp.welcome) {
            for (const p of safeParticipants) {
                try {
                    await sendBanner(sock, id, p, 'welcome', groupName, memberCount, grp.welcomeMessage || null);
                } catch (e) {
                    console.error('[eventManager] welcome send error:', e.message);
                }
            }
        }

        // ── Intro Card ────────────────────────────────────────────────
        if (action === 'add' && grp.introcard) {
            for (const p of safeParticipants) {
                try {
                    await sendIntroCard(sock, id, p, meta, grp);
                } catch (e) {
                    console.error('[eventManager] introcard error:', e.message);
                }
            }
        }

        // ── Goodbye ───────────────────────────────────────────────────
        if (action === 'remove' && grp.goodbye) {
            for (const p of safeParticipants) {
                try {
                    await sendBanner(sock, id, p, 'goodbye', groupName, memberCount, grp.goodbyeMessage || null);
                } catch (e) {
                    console.error('[eventManager] goodbye send error:', e.message);
                }
            }
        }

    } catch (e) {
        console.error('[eventManager] handleGroupParticipantsEvent error:', e.message);
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
    handleGroupParticipantsEvent,
    sendBanner,
    sendIntroCard,
};
