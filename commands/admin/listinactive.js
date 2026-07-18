'use strict';

module.exports = {
    name: 'listinactive',
    aliases: ['inactive', 'dormant', 'sleepers'],
    desc: 'List inactive/dormant members in the group',
    category: 'Admin',
    groupOnly: true,
    reactions: { start: '😴', success: '📋' },

    execute: async (sock, m, { reply }) => {
        try {
            const meta = await sock.groupMetadata(m.chat);
            const participants = meta.participants || [];

            if (!participants.length) return reply('✘ No participants found');

            // Subscribe to presence for this group
            try { await sock.presenceSubscribe(m.chat); } catch {}

            await reply('⚉ _Analyzing inactive members... please wait_');
            await new Promise(r => setTimeout(r, 2000));

            const inactive = [];
            const userPresence = global._userPresence || new Map();
            const now = Date.now();
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

            for (const p of participants) {
                const jid = p.id;
                const num = jid.split('@')[0];
                const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';

                // Get name
                let name = num;
                try {
                    const contacts = sock.store?.contacts;
                    const contact = contacts instanceof Map
                        ? contacts.get(jid)
                        : contacts?.[jid];
                    if (contact?.notify?.trim()) name = contact.notify;
                    else if (contact?.name?.trim()) name = contact.name;
                } catch {}

                // Check presence from global set
                let lastSeen = 0;
                const presence = userPresence.get(jid);
                if (presence) {
                    lastSeen = presence.timestamp;
                }

                // Consider inactive if:
                // 1. No presence data at all
                // 2. Last seen more than 7 days ago
                const isInactive = !presence || (now - lastSeen > SEVEN_DAYS);

                if (isInactive) {
                    const daysSince = lastSeen ? Math.floor((now - lastSeen) / (24 * 60 * 60 * 1000)) : null;
                    inactive.push({ jid, num, name, isAdmin, daysSince });
                }
            }

            if (!inactive.length) {
                return reply('✦ No inactive members found — everyone is active!');
            }

            // Sort by most recent first
            inactive.sort((a, b) => (b.daysSince || 0) - (a.daysSince || 0));

            const mentions = inactive.map(u => u.jid);
            let text =
                `┏━━〔 *INACTIVE MONITOR* 〕━━\n` +
                `┃\n` +
                `┃  ✦ Total    : ${participants.length}\n` +
                `┃  ◦ Inactive : ${inactive.length}\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━━━━━━━━\n\n`;

            text += `*◦ INACTIVE (${inactive.length})*\n`;
            for (const u of inactive.slice(0, 10)) {
                const badge = u.isAdmin ? '❏' : '◦';
                const timeStr = u.daysSince ? `${u.daysSince}d ago` : 'Never active';
                text += `${badge} @${u.num} — ${timeStr}\n`;
            }
            if (inactive.length > 10) text += `_...and ${inactive.length - 10} more_\n`;

            await sock.sendMessage(m.chat, { text, mentions }, { quoted: m });

        } catch (err) {
            console.error('[LISTINACTIVE ERROR]', err.message);
            reply(`✘ Error: ${err.message}`);
        }
    }
};
