/**
 * gcstatusdm — Post to a group's status feed FROM YOUR DM with the bot.
 *
 * - DM-only command
 * - Accepts a group invite link as the first argument (JID is resolved from it)
 * - Posts LINKS only (plain text is rejected — use .gcstatus inside the group)
 * - Reply to an image or video + .gcstatusdm <link> to post media to that group's status
 * - The invite code is never echoed back in bot replies (only masked preview shown)
 *
 * Usage (DM only):
 *   .gcstatusdm https://chat.whatsapp.com/XXXX https://example.com
 *   Reply to image/video + .gcstatusdm https://chat.whatsapp.com/XXXX [caption]
 */

'use strict';

const gcstatus = require('./gcstatus');
const {
    downloadMedia,
    postGroupStatus,
    encodeOpus,
    getQuotedCtx,
    TEXT_BG_COLOR,
} = gcstatus;

/** Extract the invite code from a WhatsApp group link. */
function parseInviteCode(input) {
    if (!input) return null;
    const m = String(input).match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{8,})/i);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{8,}$/.test(input)) return input;
    return null;
}

/** Mask an invite code so it isn't spoiled in bot replies.
 *  Shows first 4 chars + "•••" e.g. "L7Er•••"
 */
function maskCode(code) {
    if (!code || code.length < 4) return '•••';
    return code.slice(0, 4) + '•••';
}

module.exports = {
    name:        'gcstatusdm',
    aliases:     ['gstatusdm', 'gcstatusremote'],
    description: "Post a link or media to a group's status feed from DM using its invite link",
    usage:       '.gcstatusdm <group-link> <https://link>  OR  reply to 📷/🎥 + .gcstatusdm <group-link> [caption]',
    category:    'general',

    async execute({ sock, msg, from, sender, args, reply, isGroup, phoneNumber }) {
        if (isGroup) {
            return reply('💌 *.gcstatusdm* is DM-only. Use *.gcstatus* inside groups.');
        }

        const linkArg = args[0];
        const code    = parseInviteCode(linkArg);

        if (!code) {
            return reply(
                `📊 *GCStatus DM — Post to Group Status*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `*Usage:*\n` +
                `› \`.gcstatusdm <group-link> https://yourlink.com\`\n` +
                `› Reply to 📷 photo + \`.gcstatusdm <group-link> [caption]\`\n` +
                `› Reply to 🎥 video + \`.gcstatusdm <group-link> [caption]\`\n\n` +
                `⚠️ *Only links & media are accepted as content.*\n` +
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
            return reply(`❌ _Invalid or expired group link: ${e.message}_`);
        }

        // Verify bot is a member of that group
        const normDigits = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        let isMember = false;
        try {
            const meta = await sock.groupMetadata(groupJid);
            const botCandidates = new Set();
            if (phoneNumber)    botCandidates.add(normDigits(phoneNumber));
            if (sock.user?.id)  botCandidates.add(normDigits(sock.user.id));
            if (sock.user?.lid) botCandidates.add(normDigits(sock.user.lid));
            botCandidates.delete('');

            isMember = (meta?.participants || []).some(p => {
                const candidates = [p.id, p.jid, p.phoneNumber, p.lid]
                    .map(normDigits)
                    .filter(Boolean);
                return candidates.some(c => botCandidates.has(c));
            });
        } catch (_) {
            isMember = false;
        }

        if (!isMember) {
            return reply(
                `🚫 *Bot is not a member of that group.*\n\n` +
                `_Add the bot to the group first, then retry._`
            );
        }

        const caption = args.slice(1).join(' ').trim();
        const ctx     = getQuotedCtx(msg);
        const quoted  = ctx?.quotedMessage || null;

        // ── IMAGE ─────────────────────────────────────────────────────────────
        const imgMsg = quoted?.imageMessage || quoted?.stickerMessage;
        if (imgMsg) {
            await reply('⏳ _Posting image to group status…_');
            try {
                const type = quoted.imageMessage ? 'image' : 'sticker';
                const buf  = await downloadMedia(imgMsg, type);
                await postGroupStatus(sock, groupJid, {
                    image:   buf,
                    caption: caption || '',
                });
                return reply(
                    `✅ *Posted to group status!*\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `📸 Type: *Image*\n` +
                    `🔑 Group: \`chat.whatsapp.com/${maskCode(code)}\`\n` +
                    (caption ? `💬 Caption: _${caption}_` : ``)
                );
            } catch (err) {
                return reply(`❌ _Failed to post image: ${err.message}_`);
            }
        }

        // ── VIDEO ─────────────────────────────────────────────────────────────
        if (quoted?.videoMessage) {
            await reply('⏳ _Posting video to group status…_');
            try {
                const buf = await downloadMedia(quoted.videoMessage, 'video');
                await postGroupStatus(sock, groupJid, {
                    video:   buf,
                    caption: caption || '',
                });
                return reply(
                    `✅ *Posted to group status!*\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `🎥 Type: *Video*\n` +
                    `🔑 Group: \`chat.whatsapp.com/${maskCode(code)}\`\n` +
                    (caption ? `💬 Caption: _${caption}_` : ``)
                );
            } catch (err) {
                return reply(`❌ _Failed to post video: ${err.message}_`);
            }
        }

        // ── LINKS ONLY — reject plain text ────────────────────────────────────
        // gcstatusdm is designed for posting links (and media via reply).
        // Plain text should be posted via .gcstatus inside the group instead.
        if (!caption) {
            return reply(
                `❌ *No content provided.*\n\n` +
                `Provide a link after the group link, or reply to a 📷/🎥 and run the command.\n\n` +
                `_Example:_ \`.gcstatusdm <group-link> https://yourlink.com\``
            );
        }

        const isUrl = /https?:\/\//i.test(caption);
        if (!isUrl) {
            return reply(
                `⚠️ *Plain text not allowed via gcstatusdm.*\n\n` +
                `This command only posts *links* or *media* to group statuses.\n` +
                `Use *.gcstatus* inside the group to post plain text.`
            );
        }

        // ── LINK ─────────────────────────────────────────────────────────────
        await reply('⏳ _Posting link to group status…_');
        try {
            await postGroupStatus(sock, groupJid, {
                text:            caption,
                backgroundColor: undefined, // no bg on links — lets preview render
            });
            // Build a safe preview of the link (no code revealed)
            const safeLink = caption.replace(
                /([A-Za-z0-9_-]{8,})/g,
                (m, p, offset) => offset > 30 ? maskCode(p) : p
            ).slice(0, 60);
            return reply(
                `✅ *Posted to group status!*\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `🔗 Type: *Link*\n` +
                `🔑 Group: \`chat.whatsapp.com/${maskCode(code)}\`\n` +
                `📎 _${safeLink}${caption.length > 60 ? '…' : ''}_`
            );
        } catch (err) {
            return reply(`❌ _Failed to post link: ${err.message}_`);
        }
    },
};
