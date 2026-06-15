/**
 * AntiBot Command — Admin Only
 * Automatically removes (or warns) other bots from the group.
 * Detects bots by multi-device JID pattern:
 *   number:device@s.whatsapp.net where device > 0
 *
 * Usage:
 *   .antibot on       — enable, kick bots immediately
 *   .antibot warn     — enable, send warning first
 *   .antibot off      — disable
 *   .antibot status   — show current setting
 *   .antibot scan     — scan group for bots right now
 */

const database = require('../../utils/database');

function looksLikeBot(participantId) {
    if (!participantId) return false;
    const jid = String(participantId);
    const mdMatch = jid.match(/^(\d+):(\d+)@s\.whatsapp\.net$/);
    if (mdMatch && parseInt(mdMatch[2], 10) > 0) return true;
    return false;
}

module.exports = {
    name: 'antibot',
    aliases: ['nobot', 'antibots'],
    description: 'Automatically detect and remove other bots from the group',
    category: 'admin',

    async execute({ sock, reply, args, from, isGroup, isAdmin }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!isAdmin) return reply('🛡️ *Admin Only!*\n\n❌ You must be a group admin to use this command.');

        const action = (args[0] || '').toLowerCase();
        const grp = database.getGroup(from);
        const isEnabled = grp.antibot || false;
        const currentMode = grp.antibotMode || 'kick';

        if (!action || !['on', 'off', 'kick', 'warn', 'status', 'scan'].includes(action)) {
            return reply(
                `╔══════════════════════════╗\n` +
                `║      🤖 *ANTI-BOT*       ║\n` +
                `╚══════════════════════════╝\n\n` +
                `Status: ${isEnabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n` +
                `Mode: ${currentMode.toUpperCase()}\n\n` +
                `*Usage:*\n` +
                `▸ .antibot on     — enable (kicks bots instantly)\n` +
                `▸ .antibot warn   — enable with warning first\n` +
                `▸ .antibot off    — disable\n` +
                `▸ .antibot scan   — scan & remove bots now\n` +
                `▸ .antibot status — current settings\n\n` +
                `*Detects:*\n` +
                `✓ Multi-device bot JIDs\n` +
                `✓ Bots joining the group\n\n` +
                `_Group admins and the bot itself are always exempt._`
            );
        }

        if (action === 'status') {
            return reply(
                `🤖 *Anti-Bot Status*\n\n` +
                `Status: ${isEnabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n` +
                `Mode: *${currentMode.toUpperCase()}*\n\n` +
                `_${isEnabled
                    ? `Bots will be ${currentMode === 'kick' ? 'kicked immediately' : 'warned then kicked'}.`
                    : 'Enable with .antibot on'
                }_`
            );
        }

        if (action === 'off' || action === 'disable') {
            database.setGroup(from, 'antibot', false);
            return reply('❌ *Anti-Bot DISABLED*\n\nBots can now join and stay in this group.');
        }

        if (action === 'on' || action === 'kick' || action === 'warn') {
            const mode = action === 'warn' ? 'warn' : 'kick';
            database.setGroup(from, 'antibot', true);
            database.setGroup(from, 'antibotMode', mode);
            return reply(
                `✅ *Anti-Bot ENABLED*\n\n` +
                `Mode: *${mode.toUpperCase()}*\n\n` +
                `_${mode === 'kick'
                    ? '🦾 Bots will be kicked immediately when detected.'
                    : '⚠️ Bots will receive a warning first, then be kicked on second detection.'
                }_`
            );
        }

        if (action === 'scan') {
            await reply('🔍 *Scanning group for bots...*');
            try {
                const meta = await sock.groupMetadata(from);

                // Check if the bot itself is an admin — required to kick
                const botSelf = sock.user?.id;
                const botPhone = (botSelf || '').split('@')[0].split(':')[0].replace(/\D/g, '');
                const botJids = new Set([botSelf, `${botPhone}@s.whatsapp.net`].filter(Boolean));

                const botIsAdmin = meta.participants.some(p => {
                    const pId = String(p.id);
                    const pPhone = pId.split('@')[0].split(':')[0].replace(/\D/g, '');
                    return (botJids.has(pId) || pPhone === botPhone) && p.admin;
                });

                if (!botIsAdmin) {
                    return reply('❌ I need to be a *group admin* to remove bots!\n\nPromote me to admin first, then try again.');
                }

                // Build admin set — admins are never removed
                const adminSet = new Set(
                    meta.participants.filter(p => p.admin).map(p => p.id)
                );

                const detected = meta.participants.filter(p => {
                    if (botJids.has(p.id)) return false;
                    if (adminSet.has(p.id)) return false;
                    return looksLikeBot(p.id);
                });

                if (!detected.length) {
                    return reply('✅ *No bots detected!*\n\nYour group looks clean.');
                }

                const list = detected.map(p => `• ${p.id.split('@')[0]}`).join('\n');
                await reply(
                    `🤖 *${detected.length} bot(s) detected:*\n\n${list}\n\n` +
                    `_Removing them now..._`
                );

                let removed = 0;
                for (const bot of detected) {
                    try {
                        await sock.groupParticipantsUpdate(from, [bot.id], 'remove');
                        removed++;
                        await new Promise(r => setTimeout(r, 600));
                    } catch (_) {}
                }

                return reply(`✅ *Done!* Removed ${removed}/${detected.length} bot(s) from the group.`);
            } catch (err) {
                return reply(`❌ Scan failed: ${err.message}`);
            }
        }
    },
};
