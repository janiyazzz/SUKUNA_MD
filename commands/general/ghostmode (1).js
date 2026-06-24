/**
 * ghostmode — Suppress every outgoing read & delivery receipt.
 *
 * When ON, anyone who messages the bot will see only a single grey tick ✓
 * (sent, not delivered) — making the account look offline — even though the
 * bot actually received and processed the message normally.
 *
 * This is the opposite of `.autoread`. Turning ghostmode ON automatically
 * turns autoread OFF so they don't fight each other.
 *
 * Usage:
 *   .ghostmode          → show current status
 *   .ghostmode on       → enable  (appear offline)
 *   .ghostmode off      → disable (normal receipts)
 *
 * Owner-only.
 */

'use strict';

const database = require('../../utils/database');

module.exports = {
    name:        'ghostmode',
    aliases:     ['ghost', 'offlinemode', 'invisible'],
    description: 'Appear offline — bot reads messages but sender sees only a single grey tick',
    usage:       '.ghostmode [on|off]',
    category:    'general',
    ownerOnly:   true,

    async execute({ sock, args, reply, phoneNumber }) {
        const pn = phoneNumber
            || (sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');

        if (!pn) return reply('❌ Could not identify session — try again.');

        const sub = (args[0] || '').toLowerCase();

        if (!sub) {
            const current = database.getGhostMode(pn);
            const autoread = database.getAutoRead(pn);
            return reply(
                `👻 *Ghost Mode*\n\n` +
                `Status: ${current ? '✅ *ON*  (appearing offline)' : '❌ *OFF* (normal receipts)'}\n` +
                (autoread && !current ? `⚠️  Auto-Read is ON — turning ghost ON will disable it.\n` : '') +
                `\n` +
                `• *ON*  — every receipt is suppressed. Senders see only a *single grey tick* ✓.\n` +
                `        The bot still reads, processes & replies to every message.\n` +
                `• *OFF* — normal behaviour: delivery (✓✓) and read (👁) receipts go through.\n\n` +
                `*Toggle:* \`.ghostmode on\` / \`.ghostmode off\``
            );
        }

        if (['on', 'enable', '1', 'true', 'yes'].includes(sub)) {
            database.setGhostMode(pn, true);
            // Mutually exclusive with autoread — turning ghost ON forces
            // autoread OFF, otherwise the two settings would fight.
            const hadAutoread = database.getAutoRead(pn);
            if (hadAutoread) database.setAutoRead(pn, false);

            return reply(
                `👻 *Ghost Mode Enabled*\n\n` +
                `You now appear *offline* to anyone who messages this number.\n` +
                `They'll see only a *single grey tick* ✓ on their messages,\n` +
                `but the bot still receives and processes everything normally.\n\n` +
                (hadAutoread ? `ℹ️  Auto-Read was turned OFF (can't co-exist with ghost mode).\n\n` : '') +
                `Use \`.ghostmode off\` to go back to normal.`
            );
        }

        if (['off', 'disable', '0', 'false', 'no'].includes(sub)) {
            database.setGhostMode(pn, false);
            return reply(
                `👻 *Ghost Mode Disabled*\n\n` +
                `Receipts are back to normal — senders will once again see\n` +
                `delivery (✓✓) and read (👁) ticks.\n\n` +
                `Use \`.ghostmode on\` to hide again.`
            );
        }

        return reply(
            `⚠️ *Unknown option:* \`${args[0]}\`\n\n` +
            `Usage:\n` +
            `• \`.ghostmode\`      → show status\n` +
            `• \`.ghostmode on\`   → enable\n` +
            `• \`.ghostmode off\`  → disable`
        );
    },
};
