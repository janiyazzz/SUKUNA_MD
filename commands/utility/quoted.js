/**
 * Quoted Command — Recover a deleted message via the message that quoted it
 *
 * Scenario: Person A sends a photo/video/text/audio. Person B replies
 * (quotes) that message. Person A later deletes their original message.
 * That original content still lives inside B's stanza, embedded in
 * B's own contextInfo.quotedMessage — WhatsApp copies the quoted content
 * directly into the reply when it's sent, so deleting the original
 * afterwards does not remove it from B's message.
 *
 * Usage: tag/reply to B's message (the one that quoted the now-deleted
 * message) and run .quoted — the bot digs into B's stanza, pulls out
 * the embedded original, and resends it as-is.
 */
'use strict';

const { downloadContentFromMessage } = require('@crysnovax/baileys');

const WRAP_KEYS = [
    'ephemeralMessage',
    'viewOnceMessageV2Extension',
    'viewOnceMessageV2',
    'viewOnceMessage',
    'documentWithCaptionMessage',
];

const CONTEXT_KEYS = [
    'extendedTextMessage',
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'documentMessage',
    'stickerMessage',
    'buttonsResponseMessage',
    'listResponseMessage',
    'templateButtonReplyMessage',
    'pollCreationMessage',
    'pollCreationMessageV2',
    'pollCreationMessageV3',
];

// Strip ephemeral / view-once / document-with-caption wrappers to get
// at the real typed message underneath.
function unwrap(content) {
    if (!content || typeof content !== 'object') return content;
    let current = content;
    for (let i = 0; i < 6; i++) {
        let next = null;
        for (const key of WRAP_KEYS) {
            if (current[key]) {
                next = current[key].message || current[key];
                break;
            }
        }
        if (!next || next === current) break;
        current = next;
    }
    return current;
}

// Find the contextInfo living on a message content object, regardless
// of which type field it's nested under.
function getContextInfo(content) {
    if (!content) return null;
    for (const key of CONTEXT_KEYS) {
        if (content[key]?.contextInfo) return content[key].contextInfo;
    }
    return content.contextInfo || null;
}

// Identify the actual sendable content of a (already unwrapped) message.
function identify(content) {
    if (!content) return null;
    if (content.conversation) {
        return { type: 'text', text: content.conversation };
    }
    if (content.extendedTextMessage?.text) {
        return { type: 'text', text: content.extendedTextMessage.text };
    }
    if (content.imageMessage) return { type: 'image', media: content.imageMessage };
    if (content.videoMessage) return { type: 'video', media: content.videoMessage };
    if (content.audioMessage) return { type: 'audio', media: content.audioMessage };
    if (content.stickerMessage) return { type: 'sticker', media: content.stickerMessage };
    if (content.documentMessage) return { type: 'document', media: content.documentMessage };
    return null;
}

async function downloadMedia(mediaMsg, mediaType, retries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const stream = await downloadContentFromMessage(mediaMsg, mediaType);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buf = Buffer.concat(chunks);
            if (buf.length === 0) throw new Error('Empty buffer received');
            return buf;
        } catch (err) {
            lastErr = err;
            if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
    throw lastErr;
}

module.exports = {
    name: 'quoted',
    aliases: ['recoverquoted', 'getquoted'],
    description: "Recover a deleted message by reading it out of the message that quoted it",
    usage: '.quoted (reply to the message that quoted the now-deleted message)',
    category: 'utility',

    async execute({ sock, msg, from, reply }) {
        // ── 1. Get B — the message the user tagged when running .quoted ───
        const topCtx = getContextInfo(unwrap(msg.message));
        const bRaw = topCtx?.quotedMessage;

        if (!bRaw) {
            return reply(
                '❌ Tag (reply to) the message that quoted the deleted message, then run .quoted on it.'
            );
        }

        const bContent = unwrap(bRaw);

        // ── 2. Dig into B's own contextInfo to find A — the original,
        //      now-deleted message that B quoted ─────────────────────────
        const bCtx = getContextInfo(bContent);
        const aRaw = bCtx?.quotedMessage;

        if (!aRaw) {
            return reply(
                "❌ That message doesn't quote anything else. Tag the message that replied to the one which got deleted, not the deleted one itself."
            );
        }

        const aContent = unwrap(aRaw);
        const found = identify(aContent);

        if (!found) {
            return reply('❌ Could not recognize the content of the deleted message.');
        }

        // ── 3. Resend it as-is ─────────────────────────────────────────────
        try {
            if (found.type === 'text') {
                await sock.sendMessage(from, { text: found.text }, { quoted: msg });
                return;
            }

            const buffer = await downloadMedia(found.media, found.type);

            if (found.type === 'image') {
                await sock.sendMessage(
                    from,
                    { image: buffer, caption: found.media.caption || undefined },
                    { quoted: msg }
                );
            } else if (found.type === 'video') {
                await sock.sendMessage(
                    from,
                    {
                        video: buffer,
                        caption: found.media.caption || undefined,
                        mimetype: found.media.mimetype || 'video/mp4',
                    },
                    { quoted: msg }
                );
            } else if (found.type === 'audio') {
                await sock.sendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype: found.media.mimetype || 'audio/ogg; codecs=opus',
                        ptt: !!found.media.ptt,
                    },
                    { quoted: msg }
                );
            } else if (found.type === 'sticker') {
                await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
            } else if (found.type === 'document') {
                await sock.sendMessage(
                    from,
                    {
                        document: buffer,
                        mimetype: found.media.mimetype || 'application/octet-stream',
                        fileName: found.media.fileName || 'file',
                        caption: found.media.caption || undefined,
                    },
                    { quoted: msg }
                );
            }
        } catch (err) {
            console.error('[QUOTED] Recovery failed:', err.message);
            if (err.message?.includes('Not Found') || err.message?.includes('404')) {
                return reply('⌛ That media has expired and can no longer be recovered.');
            }
            return reply(`❌ Failed to recover the message.\n_Reason: ${err.message}_`);
        }
    },
};
