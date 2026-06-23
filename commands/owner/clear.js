/**
 * .clear — Clear the bot's local chat history for the current chat
 *
 * Uses a far-future timestamp anchor so WhatsApp wipes every single
 * message in the chat on the bot's end — including old messages that
 * predate the bot's in-memory cache. Equivalent to tapping
 * "Clear Chat → All messages" manually.
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
            // Use a far-future timestamp (year 2099) as the anchor message.
            // WhatsApp clears every message UP TO AND INCLUDING that timestamp,
            // so setting it far in the future guarantees the entire chat history
            // is wiped — including old messages that were never in the bot's cache.
            //
            // The id/fromMe fields are required by the protocol schema but the
            // timestamp is what actually controls how far back the clear reaches.
            const farFuture = Math.floor(new Date('2099-12-31').getTime() / 1000);

            await sock.chatModify(
                {
                    clear: {
                        messages: [{
                            id:        msg.key.id,
                            fromMe:    !!msg.key.fromMe,
                            timestamp: farFuture,
                        }],
                    },
                },
                from
            );

            // Also wipe the in-memory cache for this JID so the bot's own
            // anti-delete / retrieve store is clean too.
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
