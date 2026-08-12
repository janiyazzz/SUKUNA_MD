/**
 * creategc — Create a new WhatsApp group and send its invite link.
 *
 * Usage:
 *   .creategc <group name>
 *   .creategc <group name> | 2547xxxxxxx,2348xxxxxxx
 *
 * The command runner is always added as a participant. Extra numbers
 * after a `|` are added too (comma or space separated, with or without +).
 * WhatsApp requires at least one participant besides the creator, so the
 * runner's own number covers that even with no extra numbers supplied.
 *
 * Owner-gated: this spins up a real group under the bot's own WhatsApp
 * account, same precaution as .joingc.
 */

'use strict';

module.exports = {
    name: 'creategc',
    aliases: ['creategroup', 'newgc', 'mkgroup'],
    description: 'Create a WhatsApp group and get its invite link',
    category: 'owner',
    ownerOnly: true,

    execute: async (context) => {
        const { sock, msg, args, sender, reply } = context;

        try {
            const raw = args.join(' ').trim();
            if (!raw) {
                return reply(
                    `🆕 *CREATE GROUP*\n\n` +
                    `Usage:\n` +
                    `.creategc <group name>\n` +
                    `.creategc <group name> | 2547xxxxxxx,2348xxxxxxx\n\n` +
                    `You're added automatically. Numbers after "|" are added too.`
                );
            }

            const [namePart, numsPart] = raw.split('|').map(s => s?.trim());
            const groupName = namePart || 'New Group';

            if (!groupName || groupName.length < 1) {
                return reply('❌ Give the group a name.');
            }

            // Build participant list: runner + any extra numbers.
            const extraNumbers = numsPart
                ? numsPart.split(/[,\s]+/).map(n => n.replace(/[^0-9]/g, '')).filter(Boolean)
                : [];

            const participantSet = new Set([sender]);
            for (const num of extraNumbers) {
                participantSet.add(`${num}@s.whatsapp.net`);
            }
            const participants = [...participantSet];

            await reply('⏳ Creating group...');

            let group;
            try {
                group = await sock.groupCreate(groupName, participants);
            } catch (err) {
                console.error('[creategc]', err?.message || err);
                return reply('❌ Failed to create the group. Check the numbers and try again.');
            }

            if (!group?.id) {
                return reply('❌ Group creation returned no ID — try again.');
            }

            let inviteCode = group.inviteCode;
            if (!inviteCode) {
                try {
                    inviteCode = await sock.groupInviteCode(group.id);
                } catch (err) {
                    console.error('[creategc invite]', err?.message || err);
                }
            }

            if (!inviteCode) {
                return reply(
                    `✅ *Group created!*\n\n` +
                    `📛 Name: ${groupName}\n` +
                    `🆔 ID: ${group.id}\n\n` +
                    `⚠️ Couldn't fetch the invite link — try .link inside the group.`
                );
            }

            const inviteUrl = `https://chat.whatsapp.com/${inviteCode}`;

            await sock.sendMessage(msg.key.remoteJid, {
                text:
                    `╔══════════════════════════╗\n` +
                    `║   🆕 *GROUP CREATED*       ║\n` +
                    `╚══════════════════════════╝\n\n` +
                    `┌─────────────────────────\n` +
                    `│ 📛 *Name:* ${groupName}\n` +
                    `│ 👥 *Members:* ${participants.length}\n` +
                    `└─────────────────────────\n\n` +
                    `🔗 ${inviteUrl}\n\n` +
                    `> Tap the link above to open the group.`,
                richPreview:        true,
                previewTitle:       groupName,
                previewDescription: `${participants.length} members · Tap to join`,
            }, { quoted: msg });

        } catch (err) {
            console.error('[creategc]', err?.message || err);
            reply('❌ Failed to create group.');
        }
    }
};
