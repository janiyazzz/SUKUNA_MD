/**
 * .quoted — recover a deleted message via the tagged reply
 *
 * Scenario: User A sends a message (M1). User B replies to it (M2 quotes M1).
 * User A deletes M1. You reply to B's message (M2) with `.quoted` and the bot
 * resends M1 cleanly — no headers, no chatter, just the original content as a
 * reply to M2.
 *
 * Lookup order:
 *   1. Retrieve vault (silently captured deletions, 2h TTL).
 *   2. Inline `contextInfo.quotedMessage` that WhatsApp embeds in M2 itself
 *      (works for text/captions even if the vault missed it).
 *
 * Permission: bot owner, or group admins inside their group.
 */
'use strict';

const { getAll } = require('../../utils/retrieveStore');

module.exports = {
    name:        'quoted',
    aliases:     ['q', 'recover'],
    description: 'Recover the original message that the tagged reply was quoting',
    usage:       '.quoted (reply to the message that quoted the deleted one)',
    category:    'utility',

    async execute({ sock, from, msg, reply, phoneNumber, isOwner, isGroup, isAdmin }) {
        // ── Permission gate ────────────────────────────────────────────
        if (!isOwner && !(isGroup && isAdmin)) {
            return reply('🔒 _Owner or group admins only._');
        }

        // ── Pull contextInfo of the tagged message (M2) ───────────────
        const ctx =
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo        ||
            msg.message?.videoMessage?.contextInfo        ||
            msg.message?.documentMessage?.contextInfo     ||
            msg.message?.audioMessage?.contextInfo        ||
            msg.message?.stickerMessage?.contextInfo      || null;

        const stanzaId      = ctx?.stanzaId;
        const inlineQuoted  = ctx?.quotedMessage;

        if (!stanzaId && !inlineQuoted) {
            return reply(
                '❌ _Reply to the message that quoted the deleted one, then run *.quoted*._'
            );
        }

        // ── 1) Vault lookup ───────────────────────────────────────────
        const vault = getAll(phoneNumber);
        const entry = stanzaId ? vault.find(e => e.id === stanzaId) : null;

        if (entry) {
            const ok = await _sendEntry(sock, from, msg, entry);
            if (ok) return;
            // fall through to inline fallback
        }

        // ── 2) Inline contextInfo.quotedMessage fallback ──────────────
        if (inlineQuoted) {
            const ok = await _sendInline(sock, from, msg, inlineQuoted);
            if (ok) return;
        }

        return reply(
            '❌ _Couldn\'t recover — the original isn\'t in the vault and no inline copy is available._'
        );
    },
};

// ── Senders ───────────────────────────────────────────────────────

async function _sendEntry(sock, to, quotedMsg, entry) {
    const opts = { quoted: quotedMsg };
    try {
        if (entry.type === 'text' && entry.body) {
            await sock.sendMessage(to, { text: entry.body }, opts);
            return true;
        }
        if (!entry.mediaBuffer || entry.mediaBuffer.length < 100) {
            return false; // media expired — let caller try inline fallback
        }
        switch (entry.type) {
            case 'image':
                await sock.sendMessage(to, {
                    image: entry.mediaBuffer,
                    caption: entry.caption || '',
                }, opts);
                return true;
            case 'video':
                await sock.sendMessage(to, {
                    video: entry.mediaBuffer,
                    caption: entry.caption || '',
                }, opts);
                return true;
            case 'sticker':
                await sock.sendMessage(to, { sticker: entry.mediaBuffer }, opts);
                return true;
            case 'audio':
                await sock.sendMessage(to, {
                    audio:    entry.mediaBuffer,
                    mimetype: entry.mimetype || 'audio/ogg; codecs=opus',
                    ptt:      !!entry.ptt,
                }, opts);
                return true;
            case 'document':
                await sock.sendMessage(to, {
                    document: entry.mediaBuffer,
                    mimetype: entry.mimetype || 'application/octet-stream',
                    fileName: entry.fileName || 'recovered_file',
                    caption:  entry.caption  || '',
                }, opts);
                return true;
            default:
                return false;
        }
    } catch (err) {
        console.error('[QUOTED] vault send error:', err.message);
        return false;
    }
}

/**
 * Resend whatever WhatsApp embedded inline in contextInfo.quotedMessage.
 * Handles text + captions reliably. Media bodies inside contextInfo are usually
 * placeholders without encrypted-media keys, so we only resend text/caption
 * payloads here.
 */
async function _sendInline(sock, to, quotedMsg, qm) {
    const opts = { quoted: quotedMsg };
    try {
        const text =
            qm.conversation ||
            qm.extendedTextMessage?.text ||
            qm.imageMessage?.caption ||
            qm.videoMessage?.caption ||
            qm.documentMessage?.caption ||
            null;

        if (text) {
            await sock.sendMessage(to, { text }, opts);
            return true;
        }
        return false;
    } catch (err) {
        console.error('[QUOTED] inline send error:', err.message);
        return false;
    }
}
