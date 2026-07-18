'use strict';

module.exports = {
    name: 'clearchat',
    aliases: ['clear', 'clr', 'wipe'],
    category: 'tools',
    desc: 'Wipe chat then start a new thread with status',
    reactions: {
        start: '🧹',
        success: '✨'
    },

    execute: async (context) => {
        const { sock, msg: m, reply } = context;
        try {
            if (!m.key?.fromMe) {
                return reply('Owner only');
            }

            await sock.chatModify({
                delete: true,
                lastMessages: [{
                    key: m.key,
                    messageTimestamp: m.messageTimestamp
                }]
            }, m.chat);

            await new Promise(resolve => setTimeout(resolve, 2000));

            await sock.sendMessage(m.chat, {
                text: '✓ cleaned'
            });

        } catch (err) {
            console.error('[clear]', err.message);
            reply('Error: ' + err.message);
        }
    }
};
