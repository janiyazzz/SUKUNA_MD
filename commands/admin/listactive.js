/**
 * List Active Members Command
 * Usage: .listactive
 *
 * Tags all active members in the group with their message count.
 */

'use strict';

module.exports = {
    name: 'listactive',
    aliases: ['active', 'activemembers'],
    description: 'Tag all active members with message counts',
    category: 'admin',

    async execute({ sock, msg, from, reply, isGroup, db }) {
        if (!isGroup) {
            return reply('👥 This command only works in groups!');
        }

        try {
            const meta = await sock.groupMetadata(from);
            const participants = meta.participants || [];
            
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const active = [];

            const allActivity = db.getAllUserActivity(from);

            for (const participant of participants) {
                const userJid = participant.id;
                const activity = allActivity?.[userJid];
                
                let isActive = false;
                let msgCount = 0;
                let lastSeen = 0;

                if (activity) {
                    if (typeof activity === 'object') {
                        lastSeen = activity.lastSeen || 0;
                        msgCount = activity.msgCount || 0;
                    } else {
                        lastSeen = activity;
                    }
                    
                    // Active if seen within 7 days or has messages
                    if (now - lastSeen <= SEVEN_DAYS || msgCount > 0) {
                        isActive = true;
                    }
                }

                if (isActive) {
                    active.push({ jid: userJid, msgCount, lastSeen });
                }
            }

            if (active.length === 0) {
                return reply('📊 No active members found');
            }

            // Sort by message count (highest first)
            active.sort((a, b) => b.msgCount - a.msgCount);

            // Build mention string
            let mentions = active.map(a => a.jid);
            let text = `👥 *Active Members (${active.length})* 👥\n\n`;
            
            active.forEach((member, i) => {
                const name = member.jid.split('@')[0];
                const days = Math.floor((now - member.lastSeen) / (24 * 60 * 60 * 1000));
                text += `${i + 1}. @${name}\n   💬 ${member.msgCount} messages • Last: ${days}d ago\n`;
            });

            await sock.sendMessage(from, {
                text,
                mentions
            }, { quoted: msg });

        } catch (err) {
            console.error('[listactive]', err.message);
            reply(`❌ Error: ${err.message}`);
        }
    }
};
