/**
 * AutoViewStatus — Toggle automatic status view + auto-like (❤️).
 *
 * When ON, the bot automatically views and reacts to every contact's
 * status the moment it's posted.
 *
 *   .autoviewstatus       — toggle on/off
 *   .autoviewstatus on    — enable
 *   .autoviewstatus off   — disable
 *
 * Owner only.
 */
'use strict';

module.exports = {
    name:        'autoviewstatus',
    aliases:     ['autostatus', 'avs', 'autoview'],
    description: 'Auto-view and auto-like every incoming status',
    usage:       '.autoviewstatus [on|off]',
    category:    'owner',

    async execute({ args, reply, database, phoneNumber, isOwner }) {
        if (!isOwner) return reply('🔒 *This command is for the bot owner only.*');

        const current = database.getAutoViewStatus(phoneNumber);
        const arg = (args[0] || '').toLowerCase();

        let next;
        if (arg === 'on' || arg === 'enable' || arg === 'true')   next = true;
        else if (arg === 'off' || arg === 'disable' || arg === 'false') next = false;
        else next = !current;

        database.setAutoViewStatus(phoneNumber, next);

        return reply(
            `╔══════════════════════════════╗\n` +
            `║   👁️  *AUTO-VIEW STATUS*       ║\n` +
            `╚══════════════════════════════╝\n\n` +
            `Status: *${next ? '✅ ENABLED' : '❌ DISABLED'}*\n\n` +
            (next
                ? `_The bot will now automatically view and ❤️ every status as soon as it's posted._`
                : `_Auto-view and auto-like are off._`)
        );
    }
};
