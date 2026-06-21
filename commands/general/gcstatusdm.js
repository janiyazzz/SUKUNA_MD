/**
 * gcstatusdm — Post to a group's status feed FROM YOUR DM with the bot.
 *
 * Uses the exact same posting pipeline as .gcstatus (groupStatusMessageV2
 * via the @crysnovax/baileys fork). The difference: you call it in DM
 * (not inside the group) and supply the group's invite link as the first
 * argument. The bot must already be a member of that group.
 *
 * Usage (DM only):
 *   .gcstatusdm https://chat.whatsapp.com/XXXX Hello world!
 *   .gcstatusdm https://chat.whatsapp.com/XXXX https://example.com
 *   Reply to image/video/audio + .gcstatusdm https://chat.whatsapp.com/XXXX [caption]
 */

const crypto = require('crypto');

let _baileys;
let _baileysSource = 'unknown';
try {
    _baileys = require('@crysnovax/baileys');
    _baileysSource = '@crysnovax/baileys';
} catch (_) {
    _baileys = require('@whiskeysockets/baileys');
    _baileysSource = '@whiskeysockets/baileys';
}
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadContentFromMessage,
} = _baileys;
const { PassThrough } = require('stream');

const TEXT_BG_COLOR = '#9C27B0';
const TIMEOUT_MS   = 30_000;

const CHANNEL_JID  = '120363424109748354@newsletter';
const CHANNEL_NAME = 'Sukuna MD Pasqua tech';

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
function attachChannelCtxToInner(inner) {
    const keys = ['extendedTextMessage','imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
    for (const k of keys) {
        if (inner && inner[k]) {
            inner[k] = {
                ...inner[k],
                contextInfo: { ...(inner[k].contextInfo || {}), ...buildChannelCtx() },
            };
        }
    }
    return inner;
}

async function downloadMedia(mediaMsg, type) {
    return new Promise(async (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Media download timed out')), TIMEOUT_MS);
        try {
            const stream = await downloadContentFromMessage(mediaMsg, type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            clearTimeout(timer);
            resolve(Buffer.concat(chunks));
        } catch (err) {
            clearTimeout(timer);
            reject(err);
        }
    });
}

async function getGroupParticipantJids(sock, groupJid) {
    try {
        const meta = await sock.groupMetadata(groupJid);
        return (meta?.participants || []).map(p => p.id).filter(Boolean);
    } catch (e) {
        console.error('[gcstatusdm] groupMetadata failed:', e.message);
        return [];
    }
}

async function postGroupStatus(sock, groupJid, content) {
    try {
        const { backgroundColor, ...rest } = content;
        const payload = { ...rest, groupStatus: true, contextInfo: { ...buildChannelCtx() } };
        if (backgroundColor && payload.text) payload.backgroundColor = backgroundColor;
        return await sock.sendMessage(groupJid, payload);
    } catch (e) {
        console.error('[gcstatusdm] groupStatus:true path failed, falling back:', e.message);
    }

    const { backgroundColor } = content;
    const payload = { ...content };
    delete payload.backgroundColor;

    const inner = await generateWAMessageContent(payload, {
        upload: sock.waUploadToServer,
        backgroundColor: backgroundColor || TEXT_BG_COLOR,
    });
    attachChannelCtxToInner(inner);

    const secret = crypto.randomBytes(32);
    const msg = generateWAMessageFromContent(
        groupJid,
        {
            messageContextInfo: { messageSecret: secret },
            groupStatusMessageV2: {
                message: { ...inner, messageContextInfo: { messageSecret: secret } },
            },
        },
        {}
    );

    const statusJidList = await getGroupParticipantJids(sock, groupJid);
    await sock.relayMessage(groupJid, msg.message, {
        messageId: msg.key.id,
        statusJidList,
        additionalAttributes: { messageId: msg.key.id },
    });
    return msg;
}

async function encodeOpus(buffer) {
    let ffmpeg;
    try { ffmpeg = require('fluent-ffmpeg'); } catch { return buffer; }
    return new Promise((resolve) => {
        const input  = new PassThrough();
        const output = new PassThrough();
        const chunks = [];
        input.end(buffer);
        ffmpeg(input)
            .noVideo()
            .audioCodec('libopus')
            .format('ogg')
            .audioChannels(1)
            .audioFrequency(48000)
            .on('error', () => resolve(buffer))
            .on('end',   () => resolve(Buffer.concat(chunks)))
            .pipe(output);
        output.on('data', (c) => chunks.push(c));
    });
}

function getQuotedCtx(msg) {
    const m = msg.message;
    return (
        m?.extendedTextMessage?.contextInfo ||
        m?.imageMessage?.contextInfo        ||
        m?.videoMessage?.contextInfo        ||
        m?.audioMessage?.contextInfo        ||
        m?.stickerMessage?.contextInfo      ||
        null
    );
}

/** Extract the invite code from a WhatsApp group link. */
function parseInviteCode(input) {
    if (!input) return null;
    const m = String(input).match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{8,})/i);
    if (m) return m[1];
    // Bare code
    if (/^[A-Za-z0-9_-]{8,}$/.test(input)) return input;
    return null;
}

module.exports = {
    name:        'gcstatusdm',
    aliases:     ['gstatusdm', 'gcstatusremote'],
    description: "Post to a group's status feed from DM using its invite link",
    usage:       '.gcstatusdm <group-link> <text|link>  OR  reply to media + .gcstatusdm <group-link> [caption]',
    category:    'general',

    async execute({ sock, msg, from, sender, args, reply, isGroup }) {
        if (isGroup) {
            return reply('💌 *.gcstatusdm* is a DM-only command. Use *.gcstatus* inside groups.');
        }

        if (_baileysSource !== '@crysnovax/baileys') {
            return reply(
                `❌ *Group status posting requires the @crysnovax/baileys fork.*\n\n` +
                `Currently using: \`${_baileysSource}\`\n\n` +
                `Install with:\n\`npm i @crysnovax/baileys\`\n` +
                `then restart the bot.`
            );
        }

        const linkArg = args[0];
        const code    = parseInviteCode(linkArg);
        if (!code) {
            return reply(
                `╔══════════════════════════╗\n` +
                `║  📊 *GCSTATUSDM*          ║\n` +
                `╚══════════════════════════╝\n\n` +
                `*Usage:* \`.gcstatusdm <group-link> <content>\`\n\n` +
                `▸ \`.gcstatusdm https://chat.whatsapp.com/XXXX Hello!\`\n` +
                `▸ Reply to 📷/🎥/🎵 + \`.gcstatusdm <link> [caption]\`\n\n` +
                `_Bot must already be a member of that group._`
            );
        }

        // Resolve invite → groupJid
        let groupJid;
        try {
            const info = await sock.groupGetInviteInfo(code);
            groupJid = info?.id;
            if (!groupJid) throw new Error('Could not resolve group from link');
        } catch (e) {
            return reply(`❌ Invalid or expired group link: ${e.message}`);
        }

        // Verify bot is a member of that group
        let isMember = false;
        try {
            const meta = await sock.groupMetadata(groupJid);
            const botJid = sock.user?.id || '';
            const botBase = botJid.split(':')[0].split('@')[0];
            isMember = (meta?.participants || []).some(p => {
                const pbase = (p.id || '').split('@')[0].split(':')[0];
                return pbase === botBase;
            });
        } catch (_) {
            isMember = false;
        }
        if (!isMember) {
            return reply(
                `🚫 *Bot is not a member of that group.*\n\n` +
                `Join the group first (via the same link), then retry.`
            );
        }

        const caption = args.slice(1).join(' ').trim();
        const ctx     = getQuotedCtx(msg);
        const quoted  = ctx?.quotedMessage || null;

        // ── IMAGE / STICKER ──
        const imgMsg = quoted?.imageMessage || quoted?.stickerMessage;
        if (imgMsg) {
            await reply('📸 _Uploading image to group status…_');
            try {
                const type = quoted.imageMessage ? 'image' : 'sticker';
                const buf  = await downloadMedia(imgMsg, type);
                await postGroupStatus(sock, groupJid, { image: buf, caption: caption || '' });
                return reply('✅ *Image posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post image: ${err.message}`);
            }
        }

        // ── VIDEO ──
        if (quoted?.videoMessage) {
            await reply('🎥 _Uploading video to group status…_');
            try {
                const buf = await downloadMedia(quoted.videoMessage, 'video');
                await postGroupStatus(sock, groupJid, { video: buf, caption: caption || '' });
                return reply('✅ *Video posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post video: ${err.message}`);
            }
        }

        // ── AUDIO ──
        if (quoted?.audioMessage) {
            await reply('🎵 _Uploading audio to group status…_');
            try {
                const raw = await downloadMedia(quoted.audioMessage, 'audio');
                const buf = await encodeOpus(raw);
                await postGroupStatus(sock, groupJid, {
                    audio:    buf,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true,
                });
                return reply('✅ *Audio posted to group status!*');
            } catch (err) {
                return reply(`❌ Failed to post audio: ${err.message}`);
            }
        }

        // ── TEXT ──
        if (!caption) {
            return reply('❌ Provide some text after the group link, or reply to media.');
        }
        try {
            await reply('📝 _Posting text to group status…_');
            await postGroupStatus(sock, groupJid, { text: caption, backgroundColor: TEXT_BG_COLOR });
            return reply(
                `✅ *Text posted to group status!*\n\n` +
                `_"${caption.slice(0, 80)}${caption.length > 80 ? '…' : ''}"_`
            );
        } catch (err) {
            return reply(`❌ Failed to post text: ${err.message}`);
        }
    },
};
