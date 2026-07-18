'use strict';

module.exports = {
    name: 'listonline',
    aliases: ['active', 'here', 'whoisonline', 'onlinelist'],
    desc: 'List online users in the group',
    category: 'Admin',
    groupOnly: true,
    reactions: { start: '👀', success: '📝' },

    execute: async (context) => {
        const { sock, msg, reply } = context;
        try {
            if (!msg?.chat) {
                return reply('Error: No group context');
            }

            // Get group metadata
            let meta = null;
            try {
                meta = await sock.groupMetadata(msg.chat);
            } catch (err) {
                console.error('[listactive metadata]', err.message);
                return reply('Failed to fetch group info');
            }

            if (!meta?.participants || !Array.isArray(meta.participants)) {
                return reply('No participants found');
            }

            const participants = meta.participants;
            if (participants.length === 0) {
                return reply('Group is empty');
            }

            // Subscribe to presence updates
            try {
                await sock.presenceSubscribe(msg.chat);
            } catch (err) {
                console.error('[presence subscribe]', err.message);
            }

            // Wait for presence to be updated
            await new Promise(resolve => setTimeout(resolve, 2000));

            const online = [];
            const offline = [];
            const unknown = [];

            // Check each participant's presence
            for (const participant of participants) {
                try {
                    const jid = participant?.id;
                    if (!jid) continue;

                    let status = null;
                    try {
                        // Try to get presence from store
                        const presences = sock.store?.presences;
                        if (presences) {
                            // Check global presence first
                            status = presences[jid]?.lastKnownPresence;
                            
                            // Check group-specific presence
                            if (!status && presences[msg.chat]) {
                                status = presences[msg.chat][jid]?.lastKnownPresence;
                            }
                        }
                    } catch (err) {
                        console.error('[presence check]', err.message);
                    }

                    // Get participant name
                    const participantNum = jid.split('@')[0];
                    const name = participant?.notify || participant?.name || participantNum;

                    if (['available', 'composing', 'recording'].includes(status)) {
                        online.push({ jid, name, status });
                    } else if (status && status !== 'unavailable') {
                        offline.push({ jid, name, status });
                    } else {
                        unknown.push({ jid, name });
                    }
                } catch (err) {
                    console.error('[participant process]', err.message);
                }
            }

            // Build response message
            let text = `*ONLINE MEMBERS*\n\n`;
            text += `Total: ${participants.length}\n`;
            text += `Online: ${online.length}\n`;
            text += `Away: ${offline.length}\n`;
            text += `Unknown: ${unknown.length}\n\n`;

            if (online.length > 0) {
                text += `*Online (${online.length}):*\n`;
                for (const member of online.slice(0, 20)) {
                    const badge = '✓';
                    text += `${badge} @${member.jid.split('@')[0]}\n`;
                }
                if (online.length > 20) text += `...and ${online.length - 20} more\n`;
            } else {
                text += `*Online:* None\n`;
            }

            if (offline.length > 0) {
                text += `\n*Away (${offline.length}):*\n`;
                for (const member of offline.slice(0, 10)) {
                    text += `• @${member.jid.split('@')[0]}\n`;
                }
                if (offline.length > 10) text += `...and ${offline.length - 10} more\n`;
            }

            // Send with mentions of online users
            const mentions = online.map(m => m.jid);
            return await sock.sendMessage(msg.chat, { text, mentions }, { quoted: msg });

        } catch (err) {
            console.error('[listactive]', err.message);
            reply('Failed to list online members');
        }
    }
};
