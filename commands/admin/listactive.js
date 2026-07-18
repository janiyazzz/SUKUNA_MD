'use strict';

module.exports = {
    name: 'listonline',
    aliases: ['active', 'here', 'whoisonline', 'onlinelist'],
    desc: 'List online users in the group',
    category: 'Admin',
    groupOnly: true,
    reactions: { start: '👀', success: '📝' },

    execute: async (context) => {
        const { sock, msg: m, reply } = context;
        try {
            const meta = await sock.groupMetadata(m.chat);
            const participants = meta?.participants || [];

            if (!participants.length) return reply('No participants found');

            let online = 0, offline = 0, unknown = 0;
            const mentions = [];

            for (const p of participants) {
                const jid = p.id;
                let status = null;
                try {
                    status = sock.store?.presences?.[jid]?.lastKnownPresence ||
                            sock.store?.presences?.[m.chat]?.[jid]?.lastKnownPresence;
                } catch {}

                if (['available', 'composing', 'recording'].includes(status)) {
                    online++;
                    mentions.push(jid);
                } else if (status) {
                    offline++;
                } else {
                    unknown++;
                }
            }

            const text = `ONLINE USERS\n\nTotal: ${participants.length}\nOnline: ${online}\nAway: ${offline}\nHidden: ${unknown}`;
            await sock.sendMessage(m.chat, { text, mentions }, { quoted: m });

        } catch (err) {
            console.error('[listactive]', err.message);
            reply('Error: ' + err.message);
        }
    }
};
