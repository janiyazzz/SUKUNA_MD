/**
 * AFK Command — Set AFK status
 * Usage: .afk [reason]
 */

const afkUsers = new Map();

module.exports = {
    name: 'afk',
    aliases: ['away', 'busy'],
    description: 'Set your AFK status',
    category: 'group',
    async execute({ reply, args, sender, from, isGroup }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');

        const reason = args.join(' ') || 'AFK';
        const afkKey = `${from}_${sender}`;
        
        afkUsers.set(afkKey, {
            reason: reason,
            time: Date.now()
        });

        reply(
            `💤 *AFK Mode*\n\n` +
            `You are now AFK.\n` +
            `Reason: ${reason}\n\n` +
            `Send any message to disable AFK.`
        );
    },
    
    // Helper function to check AFK status (called from message handler)
    checkAFK(sock, msg, from, sender) {
        const afkKey = `${from}_${sender}`;
        const afkData = afkUsers.get(afkKey);
        
        if (afkData) {
            const duration = Math.floor((Date.now() - afkData.time) / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            
            afkUsers.delete(afkKey);
            
            sock.sendMessage(from, {
                text: `✅ *Welcome Back!*\n\nYou were AFK for ${minutes}m ${seconds}s.`,
                mentions: [sender]
            });
            
            return true;
        }
        return false;
    },
    
    // Check if mentioned user is AFK
    checkMentionedAFK(sock, from, mentionedJid) {
        for (const jid of mentionedJid) {
            const afkKey = `${from}_${jid}`;
            const afkData = afkUsers.get(afkKey);
            
            if (afkData) {
                const duration = Math.floor((Date.now() - afkData.time) / 60000);
                sock.sendMessage(from, {
                    text: `💤 *User is AFK*\n\n@${jid.split('@')[0]} is currently AFK.\nReason: ${afkData.reason}\nDuration: ${duration} minutes`,
                    mentions: [jid]
                });
            }
        }
    }
};
