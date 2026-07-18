'use strict';

const DEVICE_LABELS = {
    ios: 'iPhone (iOS)',
    android: 'Android',
    web: 'WhatsApp Web',
    desktop: 'WhatsApp Desktop',
    unknown: 'Unknown device',
};

function detectDevice(messageId) {
    // Modern WhatsApp message IDs vary in length, so prefix-based rules
    // identify the platform reliably regardless of length.
    const id = String(messageId || '').trim().toUpperCase();
    if (!id) return 'unknown';
    if (id.startsWith('3EB0')) return 'web';
    if (id.startsWith('3A')) return 'ios';
    if (id.startsWith('3F') || id.startsWith('BAE5')) return 'desktop';
    if (/^[0-9A-F]{16,40}$/.test(id)) return 'android';
    return 'unknown';
}

module.exports = {
    name: 'device',
    aliases: ['checkdevice', 'dev'],
    description: 'Detect the device a message was sent from',
    category: 'utility',
    usage: '.device (reply to a message)',

    async execute(context) {
        const { sock, msg: m, reply } = context;
        try {
            // Check if there's a quoted message
            if (!m.quoted) {
                return reply('Reply to a message with .device');
            }

            // Get the message ID from the quoted message
            const quotedMessage = m.quoted;
            let quotedId = null;

            // Try different ways to get the message ID
            if (quotedMessage.key?.id) {
                quotedId = quotedMessage.key.id;
            } else if (quotedMessage.id) {
                quotedId = quotedMessage.id;
            } else if (quotedMessage.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                quotedId = quotedMessage.message.extendedTextMessage.contextInfo.stanzaId;
            }

            if (!quotedId) {
                return reply('Cannot read message ID');
            }

            const targetSender = quotedMessage.sender || m.sender;
            const device = detectDevice(quotedId);
            const label = DEVICE_LABELS[device] || DEVICE_LABELS.unknown;
            const num = String(targetSender).split('@')[0];

            const text = `@${num}: *${label}*`;
            return sock.sendMessage(m.chat, { text }, { quoted: m });
        } catch (err) {
            console.error('[device]', err.message);
            reply('Error: ' + err.message);
        }
    },

    detectDevice,
};
