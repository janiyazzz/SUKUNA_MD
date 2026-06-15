/**
 * AntiBot Command — Admin Only
 *
 * Detection methods (layered):
 *  1. JOIN event: multi-device JID (number:N@s.whatsapp.net, N > 0)
 *  2. MESSAGE: bot-prefix triggers (., !, /, #, $, ?)
 *  3. MESSAGE: known bot response text patterns
 *  4. SCAN: checks all current members for multi-device JIDs + known patterns
 *
 * Usage:
 *   .antibot on     — enable, warn first then kick on 2nd hit
 *   .antibot kick   — enable, kick immediately on first hit
 *   .antibot warn   — enable, warn only (no kick)
 *   .antibot off    — disable
 *   .antibot status — show current settings
 *   .antibot scan   — scan group for suspected bots now
 */

const database = require('../../utils/database');

// Multi-device JID: number:device@s.whatsapp.net where device > 0
function isMdBotJid(jid) {
    const m = String(jid).match(/^(\d+):(\d+)@s\.whatsapp\.net$/);
    return m && parseInt(m[2], 10) > 0;
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
                `Mode: *${currentMode.toUpperCase()}*\n\n` +
                `*Usage:*\n` +
                `▸ .antibot on     — enable (warn → kick)\n` +
                `▸ .antibot kick   — instant kick on detection\n` +
                `▸ .antibot warn   — warn only, no kick\n` +
                `▸ .antibot off    — disable\n` +
                `▸ .antibot scan   — scan & remove bots now\n` +
                `▸ .antibot status — current settings\n\n` +
                `*Detects:*\n` +
                `✓ Multi-device bot JIDs (on join)\n` +
                `✓ Bot command prefix usage (., !, /, #)\n` +
                `✓ Known bot response signatures\n` +
                `✓ Scan of all current members\n\n` +
                `_Group admins and the bot itself are always exempt._`
            );
        }

        if (action === 'status') {
            return reply(
                `🤖 *Anti-Bot Status*\n\n` +
                `Status: ${isEnabled ? '✅ ACTIVE' : '❌ INACTIVE'}\n` +
                `Mode: *${currentMode.toUpperCase()}*\n\n` +
                `_${isEnabled
                    ? currentMode === 'kick'
                        ? 'Bots will be warned on first detection, kicked on second.'
                        : 'Bots will be warned but not kicked.'
                    : 'Enable with .antibot on or .antibot kick'
                }_`
            );
        }

        if (action === 'off') {
            database.setGroup(from, 'antibot', false);
            return reply('❌ *Anti-Bot DISABLED*');
        }

        if (action === 'on' || action === 'kick' || action === 'warn') {
            const mode = action === 'warn' ? 'warn' : 'kick';
            database.setGroup(from, 'antibot', true);
            database.setGroup(from, 'antibotMode', mode);
            return reply(
                `✅ *Anti-Bot ENABLED*\n\n` +
                `Mode: *${mode.toUpperCase()}*\n\n` +
                `_${mode === 'kick'
                    ? '🦾 Bots warned on 1st detection, kicked on 2nd.'
                    : '⚠️ Bots will receive a warning only.'
                }_`
            );
        }

        if (action === 'scan') {
            await reply('🔍 *Scanning group for bots...*');
            try {
                const meta = await sock.groupMetadata(from);
                const botSelf = sock.user?.id;
                const botPhone = (botSelf || '').split('@')[0].split(':')[0].replace(/\D/g, '');
                const botJids = new Set([botSelf, `${botPhone}@s.whatsapp.net`].filter(Boolean));

                // Check if bot is admin
                const botIsAdmin = meta.participants.some(p => {
                    const pPhone = String(p.id).split('@')[0].split(':')[0].replace(/\D/g, '');
                    return (botJids.has(p.id) || pPhone === botPhone) && p.admin;
                });

                const adminSet = new Set(
                    meta.participants.filter(p => p.admin).map(p => p.id)
                );

                const detected = meta.participants.filter(p => {
                    if (botJids.has(p.id)) return false;
                    if (adminSet.has(p.id)) return false;
                    return isMdBotJid(p.id);
                });

                if (!detected.length) {
                    return reply(
                        `✅ *No bots detected!*\n\n` +
                        `Scanned ${meta.participants.length} members.\n` +
                        `_Your group looks clean._`
                    );
                }

                const list = detected.map(p => `• @${p.id.split('@')[0]}`).join('\n');
                if (!botIsAdmin) {
                    return reply(
                        `🤖 *${detected.length} bot(s) found:*\n\n${list}\n\n` +
                        `❌ I need to be a *group admin* to remove them.\n` +
                        `_Promote me first, then run .antibot scan again._`
                    );
                }

                await reply(
                    `🤖 *${detected.length} bot(s) detected:*\n\n${list}\n\n` +
                    `_Removing now..._`
                );

                let removed = 0;
                for (const bot of detected) {
                    try {
                        await sock.groupParticipantsUpdate(from, [bot.id], 'remove');
                        removed++;
                        await new Promise(r => setTimeout(r, 600));
                    } catch (_) {}
                }

                return reply(`✅ Removed *${removed}/${detected.length}* bot(s) from the group.`);
            } catch (err) {
                return reply(`❌ Scan failed: ${err.message}`);
            }
        }
    },
};
