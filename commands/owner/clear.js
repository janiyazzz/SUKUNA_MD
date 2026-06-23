/**
 * .clear — Clear the bot's local chat history for the current chat
 *
 * Iterates every message the bot has cached for this JID and passes
 * them all to sock.chatModify({ clear: { messages: [...] } }) — the
 * same operation WhatsApp performs when you tap "Clear Chat → All
 * messages". Only affects the bot's own view; nobody else is touched.
 *
 * Works in groups and DMs. Owner only.
 *
 * Usage: .clear
 */

'use strict';

const sessionManager = require('../../lib/sessionManager');

module.exports = {
    name:        'clear',
    aliases:     ['clearchat', 'clearmessages'],
    description: "Clear the bot's local chat history for this chat (owner only)",
    usage:       '.clear',
    category:    'owner',

    async execute({ sock, from, msg, reply, isOwner, isGroup }) {
        if (!isOwner) return reply('🔒 _This command is reserved for the bot owner only._');

        // Pull every message the bot has cached for this chat.
        // _msgCache is a Map<jid, Map<msgId, msgObj>> maintained by
        // sessionManager — it captures every real message (groups + DMs).
        const chatCache = sessionManager._msgCache?.get(from);

        const cachedMessages = chatCache
            ? [...chatCache.values()].map(m => ({
                id:        m.key.id,
                fromMe:    !!m.key.fromMe,
                timestamp: Number(m.messageTimestamp) || Math.floor(Date.now() / 1000),
            }))
            : [];

        // Always include the current .clear command message itself
        // so the confirmation message is also swept out.
        const currentMsg = {
            id:        msg.key.id,
            fromMe:    !!msg.key.fromMe,
            timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
        };

        // Deduplicate (current msg may already be in cache if it arrived fast)
        const seen = new Set(cachedMessages.map(m => m.id));
        const allMessages = [...cachedMessages];
        if (!seen.has(currentMsg.id)) allMessages.push(currentMsg);

        const total = allMessages.length;

        if (total === 0) {
            return reply('📭 _Nothing to clear — no cached messages found for this chat._');
        }

        try {
            await sock.chatModify(
                { clear: { messages: allMessages } },
                from
            );

            // Wipe local cache for this JID too so bot's memory is clean
            sessionManager._msgCache?.delete(from);

            const chatLabel = isGroup ? '👥 group' : '💬 DM';
            return reply(
                `🧹 *Chat cleared!*\n\n` +
                `_Wiped *${total}* message${total !== 1 ? 's' : ''} from this ${chatLabel}._`
            );

        } catch (err) {
            console.error('[CLEAR CMD]', err.message);
            return reply(`❌ _Failed to clear chat: ${err.message}_`);
        }
    },
};
