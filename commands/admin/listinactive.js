/**
 * List Inactive Members Command
 * Usage: .listinactive
 *
 * Tags all inactive members in the group.
 */

'use strict';

module.exports = {
    name: 'listinactive',
    aliases: ['inactive', 'inactivemembers'],
    description: 'Tag all inactive members',
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
            const inactive = [];

            const allActivity = db.getAllUserActivity(from);

            for (const participant of participants) {
                const userJid = participant.id;
                const activity = allActivity?.[userJid];
                
                let isInactive = false;
                let lastSeen = 0;

                if (!activity) {
                    // Never seen = inactive
                    isInactive = true;
                } else {
                    if (typeof activity === 'object') {
                        lastSeen = activity.lastSeen || 0;
                    } else {
                        lastSeen = activity;
                    }
                    
                    // Inactive if not seen in 7+ days
                    if (now - lastSeen > SEVEN_DAYS) {
                        isInactive = true;
                    }
                }

                if (isInactive) {
                    inactive.push({ jid: userJid, lastSeen });
                }
            }

            if (inactive.length === 0) {
                return reply('📊 No inactive members found');
            }

            // Sort by last seen (oldest first)
            inactive.sort((a, b) => a.lastSeen - b.lastSeen);

            // Build mention string
            let mentions = inactive.map(a => a.jid);
            let text = `⏸️ *Inactive Members (${inactive.length})* ⏸️\n\n`;
            
            inactive.forEach((member, i) => {
                const name = member.jid.split('@')[0];
                const lastSeenText = member.lastSeen === 0 ? 'Never' : `${Math.floor((now - member.lastSeen) / (24 * 60 * 60 * 1000))}d ago`;
                text += `${i + 1}. @${name}\n   📍 Last: ${lastSeenText}\n`;
            });

            await sock.sendMessage(from, {
                text,
                mentions
            }, { quoted: msg });

        } catch (err) {
            console.error('[listinactive]', err.message);
            reply(`❌ Error: ${err.message}`);
        }
    }
};
