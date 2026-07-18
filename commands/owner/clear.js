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

            await sock.sendMessage(from, { text: 'Chat cleared' });

        } catch (err) {
            console.error('[clearchat]', err?.message || err);
            context?.reply?.('Failed to clear');
        }
    }
};
