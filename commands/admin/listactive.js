/**
 * List Active Members Command
 * Usage: .listactive
 *
 * Shows members currently online/active in WhatsApp (real-time presence)
 * Reads from WhatsApp's activity indicators - who is typing, recording, or online
 */

'use strict';

module.exports = {
    name: 'listactive',
    aliases: ['active', 'activemembers', 'online'],
    description: 'Tag all currently active/online members (real-time)',
    category: 'admin',

    async execute({ sock, msg, from, reply, isGroup, db }) {
        if (!isGroup) {
            return reply('This command only works in groups!');
        }

        try {
            const meta = await sock.groupMetadata(from);
            const participants = meta.participants || [];
            
            const active = [];
            const now = Date.now();
            const FIVE_MINS = 5 * 60 * 1000;
            
            // Get global presence map from sessionManager
            const userPresence = global._userPresence || new Map();

            for (const participant of participants) {
                const userJid = participant.id;
                
                // Check real-time presence from WhatsApp
                const presence = userPresence.get(userJid);
                let isActive = false;
                let status = 'offline';

                if (presence) {
                    const timeSinceUpdate = now - presence.timestamp;
                    
                    // Active if presence updated in last 5 minutes
                    if (timeSinceUpdate < FIVE_MINS) {
                        isActive = true;
                        
                        if (presence.state === 'composing') status = 'typing...';
                        else if (presence.state === 'recording') status = 'recording...';
                        else if (presence.state === 'available') status = 'online';
                        else status = 'idle';
                    }
                }

                // Fallback: check recent messages if presence not available
                if (!isActive && db) {
                    const msgCount = db.getMessageCount?.(from, userJid) || 0;
                    const lastSeen = db.getLastSeen?.(from, userJid) || 0;
                    
                    if (msgCount > 0 && lastSeen && (now - lastSeen < FIVE_MINS)) {
                        isActive = true;
                        status = 'messaging';
                    }
                }

                if (isActive) {
                    active.push({
                        jid: userJid,
                        name: participant.pushName || 'Unknown',
                        status: status
                    });
                }
            }

            if (active.length === 0) {
                return reply('No active members right now');
            }

            // Build mention message
            let mentions = active.map(a => a.jid);
            let text = `Active Members (${active.length}):\n\n`;
            
            active.forEach((member, i) => {
                text += `${i + 1}. @${member.jid.split('@')[0]} - ${member.status}\n`;
            });

            await sock.sendMessage(from, {
                text,
                mentions
            }, { quoted: msg });

        } catch (err) {
            console.error('[listactive]', err.message);
            reply(`Error: ${err.message}`);
        }
    }
};
