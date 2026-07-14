/**
 * List Active Members Command
 * Usage: .listactive
 *
 * Tags all active members in the group with their message count.
 * Active members are those who have sent messages recently (within 7 days).
 */

'use strict';

module.exports = {
    name: 'listactive',
    aliases: ['active', 'activemembers'],
    description: 'List and tag all active members with message counts',
    category: 'admin',

    async execute({ sock, msg, from, reply, isGroup, db }) {
        if (!isGroup) {
            return reply('👥 This command can only be used in groups!');
        }

        try {
            const meta = await sock.groupMetadata(from);
            const participants = meta.participants || [];
            
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const activeMembers = [];

            // Get all user activity from database
            const allActivity = db.getAllUserActivity(from);

            // Find active members
            for (const participant of participants) {
                const userJid = participant.id;
                const activity = allActivity?.[userJid];
                
                let lastSeenTime = 0;
                let msgCount = 0;

                if (activity) {
                    if (typeof activity === 'object') {
                        lastSeenTime = activity.lastSeen || 0;
                        msgCount = activity.msgCount || 0;
                    } else {
                        lastSeenTime = activity;
                    }
                }

                // Consider active if seen within 7 days or has messages
                if (msgCount > 0 || (now - lastSeenTime < SEVEN_DAYS && lastSeenTime > 0)) {
                    const daysSinceActive = lastSeenTime > 0 ? Math.floor((now - lastSeenTime) / (24 * 60 * 60 * 1000)) : 'new';
                    activeMembers.push({
                        jid: userJid,
                        name: participant.pushName || 'Unknown',
                        msgCount: msgCount,
                        lastSeen: lastSeenTime,
                        daysSince: daysSinceActive
                    });
                }
            }

            if (activeMembers.length === 0) {
                return reply('❌ No active members found in this group.');
            }

            // Sort by message count (descending)
            activeMembers.sort((a, b) => b.msgCount - a.msgCount);

            // Build mentions string
            let mentionText = `👥 *ACTIVE MEMBERS* (${activeMembers.length})\n\n`;
            mentionText += `Group: *${meta.subject}*\n`;
            mentionText += `Updated: ${new Date().toLocaleString()}\n\n`;
            mentionText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

            const mentionedJids = [];
            
            for (let i = 0; i < activeMembers.length; i++) {
                const member = activeMembers[i];
                const dayText = member.daysSince === 'new' ? 'just joined' : `${member.daysSince}d ago`;
                
                mentionText += `${i + 1}. @${member.jid.split('@')[0]}\n`;
                mentionText += `   💬 Messages: ${member.msgCount}\n`;
                mentionText += `   ⏰ Active: ${dayText}\n\n`;
                
                mentionedJids.push(member.jid);
            }

            mentionText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            mentionText += `Total Active: *${activeMembers.length}*\n`;
            mentionText += `\n> SUKUNA MD`;

            // Send message with mentions
            await sock.sendMessage(from, {
                text: mentionText,
                mentions: mentionedJids
            }, { quoted: msg });

        } catch (err) {
            console.error('[listactive] Error:', err.message);
            reply(`❌ Failed to list active members: ${err.message}`);
        }
    }
};
