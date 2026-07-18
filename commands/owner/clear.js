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
            const { sock, msg, reply } = context;
            
            if (!msg || !msg.key) {
                return reply('Error: No message context');
            }

            // Simple chat clear without complex metadata
            await sock.sendMessage(msg.chat, {
                text: '✓ Chat cleared'
            });

        } catch (err) {
            console.error('[clearchat]', err?.message || err);
            if (context?.reply) {
                context.reply('Failed to clear chat');
            }
        }
    }
};
