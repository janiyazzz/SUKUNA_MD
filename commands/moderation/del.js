/**
 * .del / .delete — delete a message for everyone, by replying to it.
 *
 * Usage: reply to a message + `.del` (or `.delete`)
 *
 *   • Reply to the BOT's own message (any chat — group or DM)
 *       → always deletable, since WhatsApp always lets an account delete
 *         its own messages for everyone. No admin check needed.
 *
 *   • Reply to someone ELSE's message in a GROUP
 *       → gated behind admin status (same as .kick/.mute/.warn): only the
 *         owner or a group admin can trigger this. WhatsApp additionally
 *         enforces server-side that only an admin account can revoke
 *         another member's message — since this is a self-bot, the
 *         account issuing the command IS the account performing the
 *         delete, so the admin gate here lines up with that requirement.
 *
 *   • Reply to someone ELSE's message in a private 1:1 chat
 *       → WhatsApp never allows deleting another person's DM message for
 *         everyone, admin or not, so this is refused up front.
 */

const sessionManager = require('../../lib/sessionManager');

module.exports = {
    name: 'del',
    aliases: ['delete'],
    description: "Delete a replied-to message — your own anywhere, or anyone's in a group if you're an admin",
    category: 'moderation',
    usage: '.del (reply to a message)',

    async execute({ sock, msg, from, isGroup, isAdmin, reply }) {
        try {
            const ctxInfo =
                msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo ||
                null;

            const quotedId = ctxInfo?.stanzaId;
            if (!quotedId) {
                return reply(
                    '❌ *Reply to a message* with `.del` (or `.delete`) to delete it.\n\n' +
                    "• Reply to the bot's own message → always deletable.\n" +
                    "• Reply to someone else's message in a group → only works if you're a group admin."
                );
            }

            // contextInfo never carries a "fromMe" flag for the quoted
            // message, so we look up the REAL cached message (captured by
            // the message listener for every chat) to get its actual
            // key.fromMe / key.participant. Falls back to a best-effort
            // JID comparison only if it somehow fell out of cache.
            const cached = sessionManager.getCachedMessage(from, quotedId);

            let quotedFromMe;
            let quotedParticipant = ctxInfo.participant || null;

            if (cached?.key) {
                quotedFromMe = !!cached.key.fromMe;
                quotedParticipant = cached.key.participant || quotedParticipant;
            } else if (isGroup) {
                const botNum = (sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
                const qNum = (quotedParticipant || '').split('@')[0].split(':')[0].replace(/\D/g, '');
                quotedFromMe = !!qNum && qNum === botNum;
            } else {
                // Uncached DM message — best-effort assume it's our own;
                // if it's actually the other person's, WhatsApp's server
                // will simply reject the delete and we report that below.
                quotedFromMe = true;
            }

            // WhatsApp never allows deleting someone else's message for
            // everyone in a private 1:1 chat — no admin escape hatch there.
            if (!isGroup && !quotedFromMe) {
                return reply(
                    "❌ I can only delete *my own* messages in a private chat — " +
                    "WhatsApp doesn't allow deleting someone else's DM message for everyone."
                );
            }

            // Deleting someone ELSE's message in a group is an elevated
            // action — gate it behind admin status, same as every other
            // moderation command in this bot (.kick, .mute, .warn, etc.).
            if (isGroup && !quotedFromMe && !isAdmin) {
                return reply('🔒 Admins only — you need to be a group admin to delete someone else\'s message.');
            }

            const deleteKey = {
                remoteJid: from,
                fromMe: quotedFromMe,
                id: quotedId,
            };
            if (isGroup) {
                deleteKey.participant = quotedFromMe
                    ? `${(sock.user?.id || '').split(':')[0]}@s.whatsapp.net`
                    : quotedParticipant;
            }

            await sock.sendMessage(from, { delete: deleteKey });
            await sock.sendMessage(from, { react: { text: '🗑️', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[del]', err);
            reply(`❌ Failed to delete: ${err.message || 'unknown error'}`);
        }
    },
};
