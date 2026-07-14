/**
 * List Inactive Members Command
 * Usage: .listinactive
 *
 * Tags all inactive members in the group with their last activity.
 * Inactive members are those who haven't sent messages in 7+ days or never interacted.
 */

'use strict';

module.exports = {
    name: 'listinactive',
    aliases: ['inactive', 'inactivemembers'],
    description: 'List and tag all inactive members',
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
            const inactiveMembers = [];

            // Get all user activity from database
            const allActivity = db.getAllUserActivity(from);

            // Find inactive members
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

                // Consider inactive if no messages or last seen > 7 days ago
                if (msgCount === 0 || (lastSeenTime === 0) || (now - lastSeenTime >= SEVEN_DAYS)) {
                    let daysSinceActive = 'never';
                    if (lastSeenTime > 0) {
                        daysSinceActive = Math.floor((now - lastSeenTime) / (24 * 60 * 60 * 1000));
                    }

                    inactiveMembers.push({
                        jid: userJid,
                        name: participant.pushName || 'Unknown',
                        msgCount: msgCount,
                        lastSeen: lastSeenTime,
                        daysSince: daysSinceActive
                    });
                }
            }

            if (inactiveMembers.length === 0) {
                return reply('✅ No inactive members! Everyone is active in this group.');
            }

            // Sort by last seen (oldest first)
            inactiveMembers.sort((a, b) => {
                if (a.lastSeen === 0) return -1; // Never seen goes first
                if (b.lastSeen === 0) return 1;
                return a.lastSeen - b.lastSeen;
            });

            // Build mentions string
            let mentionText = `😴 *INACTIVE MEMBERS* (${inactiveMembers.length})\n\n`;
            mentionText += `Group: *${meta.subject}*\n`;
            mentionText += `Updated: ${new Date().toLocaleString()}\n\n`;
            mentionText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

            const mentionedJids = [];
            
            for (let i = 0; i < inactiveMembers.length; i++) {
                const member = inactiveMembers[i];
                const dayText = member.daysSince === 'never' ? 'never active' : `${member.daysSince}d`;
                
                mentionText += `${i + 1}. @${member.jid.split('@')[0]}\n`;
                mentionText += `   💬 Messages: ${member.msgCount}\n`;
                mentionText += `   ⏰ Last Seen: ${dayText} ago\n\n`;
                
                mentionedJids.push(member.jid);
            }

            mentionText += `━━━━━━━━━━━━━━━━━━━━━\n`;
            mentionText += `Total Inactive: *${inactiveMembers.length}*\n`;
            mentionText += `\n> SUKUNA MD`;

            // Send message with mentions
            await sock.sendMessage(from, {
                text: mentionText,
                mentions: mentionedJids
            }, { quoted: msg });

        } catch (err) {
            console.error('[listinactive] Error:', err.message);
            reply(`❌ Failed to list inactive members: ${err.message}`);
        }
    }
};
