/**
 * UnmuteSticker Command — Unblock a blocked sticker
 * Usage: Reply to a blocked sticker with .unmutesticker
 */

const database = require('../../utils/database');

module.exports = {
    name: 'unmutesticker',
    aliases: ['unblocksticker', 'stickerunban'],
    description: 'Unblock a previously blocked sticker',
    category: 'moderation',
    async execute({  sock, msg, from, reply, isGroup, isAdmin }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        // ── Admin Gate — only group admins can use this command ──
        if (!isAdmin) {
            return reply('🛡️ *Admin Only!*\n\n❌ You must be a group admin to use this command.');
        }


        try {

            // Get quoted message
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
            
            if (!quotedMsg) {
                return reply(
                    `✅ *Unmute Sticker*\n\n` +
                    `Unblock a previously blocked sticker.\n\n` +
                    `*Usage:*\n` +
                    `Reply to a blocked sticker with: .unmutesticker`
                );
            }

            // Load the quoted message
            const messageId = quotedMsg.stanzaId;
            const remoteJid = quotedMsg.remoteJid || from;
            
            const quotedMessage = await sock.loadMessage(remoteJid, messageId);
            
            if (!quotedMessage) {
                return reply('❌ Could not load the quoted message.');
            }

            const stickerData = quotedMessage.message?.stickerMessage;
            
            if (!stickerData) {
                return reply('❌ The quoted message is not a sticker.');
            }

            const stickerId = stickerData.fileSha256 || stickerData.fileEncSha256;
            
            if (!stickerId) {
                return reply('❌ Could not identify the sticker.');
            }

            const stickerHash = Buffer.from(stickerId).toString('base64');
            
            // Check if blocked
            if (!database.isStickerBlocked(from, stickerHash)) {
                return reply('❌ This sticker is not blocked!');
            }

            // Unblock the sticker
            database.unblockSticker(from, stickerHash);

            reply(
                `✅ *Sticker Unblocked*\n\n` +
                `This sticker has been unblocked.\n` +
                `It can now be sent normally.`
            );

        } catch (err) {
            console.error('[UnmuteSticker Error]', err);
            reply('❌ An error occurred while unblocking the sticker.');
        }
    }
};
