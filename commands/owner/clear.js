/**
 * .clear — Delete the bot's local chat history for the current chat
 *
 * Uses chatModify({ delete: true }) with the triggering message as the
 * lastMessages anchor. WhatsApp uses that key + timestamp to know which
 * chat to wipe on the bot's end.
 *
 * A 2-second delay is inserted after the call to give the WA server time
 * to process the delete before the success reply is sent.
 *
 * Only affects the bot's own local view. No one else is touched.
 * Works in groups and DMs. Owner only.
 *
 * Usage: .clear
 */

'use strict';

module.exports = {
    name:        'clear',
    aliases:     ['clearchat', 'clearmessages'],
    description: "Clear the bot's local chat history for this chat (owner only)",
    usage:       '.clear',
    category:    'owner',

    async execute({ sock, from, msg, reply, isOwner, isGroup }) {
        if (!isOwner) return reply('🔒 _This command is reserved for the bot owner only._');

        try {
            // chatModify with delete:true wipes the entire chat on the bot's
            // local view. lastMessages must contain the anchor message key +
            // its Unix timestamp (in seconds) so Baileys can build the correct
            // WA protocol payload.
            await sock.chatModify({
                delete: true,
                lastMessages: [{
                    key:              msg.key,
                    messageTimestamp: msg.messageTimestamp,
                }],
            }, from);

            // Give WhatsApp server 2 s to process the delete before we reply.
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Also wipe the in-memory cache for this JID so the bot's own
            // anti-delete / retrieve store stays clean too.
            try {
                const sessionManager = require('../../lib/sessionManager');
                sessionManager._msgCache?.delete(from);
            } catch (_) {}

            const chatLabel = isGroup ? '👥 group' : '💬 DM';
            return reply(`🧹 *Chat cleared!*\n\n_All messages in this ${chatLabel} have been wiped from the bot's view._`);

        } catch (err) {
            console.error('[CLEAR CMD]', err.message);
            return reply(`❌ _Failed to clear chat: ${err.message}_`);
        }
    },
};
