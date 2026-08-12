/**
 * creategc — Create a new WhatsApp group and send its invite link.
 *
 * Usage:
 *   .creategc                                       (auto-named group)
 *   .creategc <group name>
 *   .creategc <group name> | 2547xxxxxxx,2348xxxxxxx
 *
 * Nothing is mandatory. Run it bare and it creates a group with an
 * auto-generated name and just the runner in it. The command runner is
 * always added as a participant — WhatsApp requires at least one
 * participant besides the creator, so that alone is enough to create the
 * group even with zero numbers supplied. A name and/or extra numbers
 * after a `|` (comma or space separated, with or without +) are optional
 * add-ons, not requirements.
 *
 * Owner-gated: this spins up a real group under the bot's own WhatsApp
 * account, same precaution as .joingc.
 */

'use strict';

function defaultGroupName() {
    const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `New Group · ${stamp}`;
}

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

            const [namePart, numsPart] = raw ? raw.split('|').map(s => s?.trim()) : ['', ''];
            const groupName = namePart || defaultGroupName();

            // Build participant list: runner + any extra numbers (optional).
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
