/**
 * ghostmode — Suppress ALL read & delivery receipts for incoming messages.
 *
 * When ON, anyone who messages this bot number sees only a SINGLE tick
 * (sent, not delivered). The bot still receives and processes the message
 * normally — it just stops sending receipts back to the sender, so the
 * sender thinks the user is offline / hasn't received it.
 *
 * Works for both group chats and private DMs.
 *
 * Usage:
 *   .ghostmode         → show current status
 *   .ghostmode on      → enable (single-tick mode)
 *   .ghostmode off     → disable (normal receipts)
 *
 * Owner-only — visible only to the bot owner.
 *
 * Implementation: the per-session sock has its sendReceipt / sendReceipts
 * (and readMessages) methods patched in lib/sessionManager.js. Those patches
 * read the live database flag on every call, so toggling here takes effect
 * instantly without reconnecting.
 */
'use strict';

const database = require('../../utils/database');

module.exports = {
    name:        'ghostmode',
    aliases:     ['ghost', 'ghostmd', 'singletick', 'invisible'],
    description: 'Hide read/delivery ticks — appear offline to senders (groups + DMs)',
    usage:       '.ghostmode [on|off]',
    category:    'general',
    ownerOnly:   true,

    async execute({ sock, msg, from, args, reply, phoneNumber }) {
        const pn = phoneNumber
            || (sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');

        if (!pn) return reply('❌ Could not identify session — try again.');

        const sub = (args[0] || '').toLowerCase();

        if (!sub) {
            const current = database.getGhostMode(pn);
            return reply(
                `👻 *Ghost Mode*\n\n` +
                `Status: ${current ? '✅ *ON*' : '❌ *OFF*'}\n\n` +
                `• When *ON*  — every incoming message (group & DM) is silently received.\n` +
                `  Senders see only *one grey tick* ✓ (looks like you're offline / message\n` +
                `  not delivered), but the bot still gets and processes it normally.\n\n` +
                `• When *OFF* — normal WhatsApp behaviour; delivery + read receipts fire.\n\n` +
                `*Toggle:* \`.ghostmode on\` / \`.ghostmode off\`\n\n` +
                `_Note: this is the opposite of \`.autoread\`. Turning ghost mode ON\n` +
                `automatically suppresses autoread too._`
            );
        }

        if (['on','enable','1','true','yes'].includes(sub)) {
            database.setGhostMode(pn, true);
            // Also flip autoread off so we don't fight ourselves
            try { database.setAutoRead(pn, false); } catch {}
            return reply(
                `👻 *Ghost Mode Enabled*\n\n` +
                `You are now *invisible* — senders will see only a single grey tick ✓\n` +
                `even though the bot is receiving every message.\n\n` +
                `Use \`.ghostmode off\` to restore normal receipts.`
            );
        }

        if (['off','disable','0','false','no'].includes(sub)) {
            database.setGhostMode(pn, false);
            return reply(
                `✅ *Ghost Mode Disabled*\n\n` +
                `Normal WhatsApp receipts restored. Delivery + read ticks will fire again.\n\n` +
                `Use \`.ghostmode on\` to re-enable.`
            );
        }

        return reply(
            `⚠️ *Unknown option:* \`${args[0]}\`\n\n` +
            `Usage:\n` +
            `• \`.ghostmode\`      → show status\n` +
            `• \`.ghostmode on\`   → enable single-tick mode\n` +
            `• \`.ghostmode off\`  → disable`
        );
    },
};
