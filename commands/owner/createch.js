/**
 * createch — Create a new WhatsApp Channel (newsletter) and send its link.
 *
 * Usage:
 *   .createch <channel name>
 *   .createch <channel name> | <description>
 *
 * Owner-gated: this spins up a real channel under the bot's own WhatsApp
 * account, same precaution as .creategc / .joingc.
 */

'use strict';

module.exports = {
    name: 'createch',
    aliases: ['createchannel', 'newch', 'mkchannel'],
    description: 'Create a WhatsApp Channel and get its link',
    category: 'owner',
    ownerOnly: true,

    execute: async (context) => {
        const { sock, msg, args, reply } = context;

        try {
            const raw = args.join(' ').trim();
            if (!raw) {
                return reply(
                    `🆕 *CREATE CHANNEL*\n\n` +
                    `Usage:\n` +
                    `.createch <channel name>\n` +
                    `.createch <channel name> | <description>`
                );
            }

            const [namePart, descPart] = raw.split('|').map(s => s?.trim());
            const channelName = namePart || 'New Channel';
            const description = descPart || 'Official channel';

            if (!channelName || channelName.length < 1) {
                return reply('❌ Give the channel a name.');
            }

            await reply('⏳ Creating channel...');

            let channel;
            try {
                channel = await sock.newsletterCreate(channelName, description);
            } catch (err) {
                console.error('[createch]', err?.message || err);
                return reply('❌ Failed to create the channel. Try again shortly.');
            }

            if (!channel?.id) {
                return reply('❌ Channel creation returned no ID — try again.');
            }

            const channelKey = channel.id.split('@')[0];
            const channelUrl = `https://whatsapp.com/channel/${channelKey}`;

            await sock.sendMessage(msg.key.remoteJid, {
                text:
                    `╔══════════════════════════╗\n` +
                    `║   🆕 *CHANNEL CREATED*     ║\n` +
                    `╚══════════════════════════╝\n\n` +
                    `┌─────────────────────────\n` +
                    `│ 📛 *Name:* ${channelName}\n` +
                    `│ 📝 *About:* ${description}\n` +
                    `└─────────────────────────\n\n` +
                    `🔗 ${channelUrl}\n\n` +
                    `> Tap the link above to open the channel.`,
                richPreview:        true,
                previewTitle:       channelName,
                previewDescription: description,
            }, { quoted: msg });

        } catch (err) {
            console.error('[createch]', err?.message || err);
            reply('❌ Failed to create channel.');
        }
    }
};
