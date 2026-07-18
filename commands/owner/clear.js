'use strict';

module.exports = {
    name: 'clearchat',
    aliases: ['clear', 'clr', 'wipe'],
    category: 'tools',
    desc: 'Wipe chat history',
    reactions: {
        start: '🧹',
        success: '✨'
    },

    execute: async (context) => {
        try {
            const { sock, from, reply } = context;
            
            if (!sock || !from) {
                return reply('Invalid context');
            }

            // Delete all messages in the chat
            try {
                await sock.chatModify({
                    delete: true,
                    lastMessages: [{ key: { remoteJid: from, fromMe: false } }]
                }, from);
            } catch (err) {
                console.error('[delete messages]', err.message);
            }

            // Clear the conversation
            try {
                await sock.clearMessage(from);
            } catch (err) {
                console.error('[clear conversation]', err.message);
            }

            await reply('Chat cleared');

        } catch (err) {
            console.error('[clearchat]', err?.message || err);
            context?.reply?.('Failed');
        }
    }
};
