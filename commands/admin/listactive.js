'use strict';

module.exports = {
    name: 'listonline',
    aliases: ['active', 'here', 'whoisonline', 'onlinelist'],
    desc: 'List online users in the group',
    category: 'Admin',
    groupOnly: true,
    reactions: { start: '👀', success: '📝' },

    execute: async (context) => {
        const { sock, from, reply, msg } = context;
        try {
            if (!from || !sock) {
                return reply('Invalid context');
            }

            let meta = null;
            try {
                meta = await sock.groupMetadata(from);
            } catch (err) {
                console.error('[metadata]', err.message);
                return reply('Cannot fetch group info');
            }

            if (!meta?.participants || meta.participants.length === 0) {
                return reply('No participants');
            }

            try {
                await sock.presenceSubscribe(from);
            } catch {}

            await new Promise(r => setTimeout(r, 1000));

            const online = [];
            const presences = sock.store?.presences || {};

            for (const p of meta.participants) {
                try {
                    const jid = p?.id;
                    if (!jid) continue;

                    let status = presences[jid]?.lastKnownPresence || presences[from]?.[jid]?.lastKnownPresence;
                    
                    if (['available', 'composing', 'recording'].includes(status)) {
                        online.push(jid);
                    }
                } catch {}
            }

            let text = `Online: ${online.length}/${meta.participants.length}`;
            if (online.length > 0) {
                text += `\n\n${online.slice(0, 20).map(j => '✓ @' + j.split('@')[0]).join('\n')}`;
                if (online.length > 20) text += `\n+${online.length - 20} more`;
            }

            return await sock.sendMessage(from, { text, mentions: online }, { quoted: msg });

        } catch (err) {
            console.error('[listactive]', err.message);
            reply('Error checking online');
        }
    }
};
