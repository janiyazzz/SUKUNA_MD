'use strict';

module.exports = {
    name: 'listinactive',
    aliases: ['inactive', 'dormant', 'sleepers'],
    desc: 'List inactive/dormant members in the group',
    category: 'Admin',
    groupOnly: true,
    reactions: { start: '😴', success: '📋' },

    execute: async (context) => {
        const { sock, msg: m, reply } = context;
        try {
            const meta = await sock.groupMetadata(m.chat);
            const participants = meta?.participants || [];

            if (!participants.length) return reply('No participants found');

            const userPresence = global._userPresence || new Map();
            const now = Date.now();
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            const inactive = [];

            for (const p of participants) {
                const jid = p.id;
                const presence = userPresence.get(jid);
                let lastSeen = presence?.timestamp || 0;
                
                if (!presence || (now - lastSeen > SEVEN_DAYS)) {
                    const days = lastSeen ? Math.floor((now - lastSeen) / (24 * 60 * 60 * 1000)) : 'Never';
                    inactive.push({ jid, days });
                }
            }

            if (!inactive.length) return reply('No inactive members');

            const mentions = inactive.map(u => u.jid);
            let text = `INACTIVE MEMBERS\n\nTotal: ${participants.length}\nInactive: ${inactive.length}\n\n`;
            for (const u of inactive.slice(0, 15)) {
                text += `@${u.jid.split('@')[0]} — ${u.days}d\n`;
            }

            await sock.sendMessage(m.chat, { text, mentions }, { quoted: m });

        } catch (err) {
            console.error('[listinactive]', err.message);
            reply('Error: ' + err.message);
        }
    }
};
