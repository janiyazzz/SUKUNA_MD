'use strict';

module.exports = {
    name: 'listonline',
    aliases: ['active', 'here', 'whoisonline', 'onlinelist'],
    desc: 'List online users in the group',
    category: 'Admin',
    groupOnly: true,
    reactions: { start: '👀', success: '📝' },

    execute: async (context) => {
        const { sock, from, reply } = context;
        try {
            if (!from || !sock) {
                return reply('Invalid context');
            }

            const meta = await sock.groupMetadata(from).catch(() => null);
            if (!meta?.participants) {
                return reply('No participants');
            }

            try {
                await sock.presenceSubscribe(from);
            } catch {}

            await new Promise(r => setTimeout(r, 1500));

            const online = [];
            const offline = [];

            for (const p of meta.participants) {
                const jid = p?.id;
                if (!jid) continue;

                let status = null;
                try {
                    status = sock.store?.presences?.[jid]?.lastKnownPresence ||
                            sock.store?.presences?.[from]?.[jid]?.lastKnownPresence;
                } catch {}

                if (['available', 'composing', 'recording'].includes(status)) {
                    online.push(jid);
                } else if (status) {
                    offline.push(jid);
                }
            }

            let text = `Online: ${online.length}\nAway: ${offline.length}\nTotal: ${meta.participants.length}`;
            if (online.length > 0) {
                text += `\n\nOnline:\n${online.slice(0, 15).map(j => '✓ @' + j.split('@')[0]).join('\n')}`;
                if (online.length > 15) text += `\n...${online.length - 15} more`;
            }

            return await sock.sendMessage(from, { text, mentions: online }, { quoted: context.msg });

        } catch (err) {
            console.error('[listactive]', err.message);
            reply('Failed');
        }
    }
};
