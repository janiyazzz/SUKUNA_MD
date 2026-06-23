/**
 * .clear — Clear the bot's local chat history for the current chat
 *
 * Works in groups and DMs. Owner only.
 * This is the programmatic equivalent of manually tapping
 * "Clear Chat" in WhatsApp — it only affects the bot's own view,
 * not anyone else's chat history.
 *
 * Usage:
 *   .clear          — clears chat history for the current chat
 */

'use strict';

module.exports = {
    name:        'clear',
    aliases:     ['clearchat', 'clearmessages'],
    description: 'Clear the bot\'s local chat history for this chat (owner only)',
    usage:       '.clear',
    category:    'owner',

    async execute({ sock, from, msg, reply, isOwner, isGroup }) {
        if (!isOwner) return reply('🔒 _This command is reserved for the bot owner only._');

        try {
            // chatModify with 'clear' wipes the local message store for this
            // JID on the bot's end — same as tapping "Clear Chat" manually.
            // lastMessages must contain the most recent message so WhatsApp
            // knows up to which point to clear.
            await sock.chatModify(
                {
                    clear: { messages: [{ id: msg.key.id, fromMe: msg.key.fromMe, timestamp: msg.messageTimestamp }] },
                },
                from
            );

            const chatLabel = isGroup ? '👥 group' : '💬 DM';
            return reply(`🧹 *Chat cleared!*\n\n_The bot's local history for this ${chatLabel} has been wiped._`);

        } catch (err) {
            console.error('[CLEAR CMD]', err.message);

            // Fallback: if chatModify isn't available on this Baileys build,
            // try the older deleteChat approach.
            try {
                await sock.chatModify({ delete: true }, from);
                const chatLabel = isGroup ? '👥 group' : '💬 DM';
                return reply(`🧹 *Chat cleared!*\n\n_The bot's local history for this ${chatLabel} has been wiped._`);
            } catch (err2) {
                console.error('[CLEAR CMD fallback]', err2.message);
                return reply(`❌ _Failed to clear chat: ${err.message}_`);
            }
        }
    },
};
