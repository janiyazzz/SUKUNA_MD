/**
 * Report Command — Report and block WhatsApp contacts
 * Usage:
 *   .report @user            - Report once and block
 *   .report <number>         - Report by phone number and block
 *   .report 2 @user          - Report 2 times (block on 1st, unblock after 2nd)
 *   .report 3 @user          - Report 3 times (same block/unblock logic)
 *   .report group <groupId>  - Report and leave a group
 */

'use strict';

function extractTarget(msg, args) {
    // Check for mentions in extended text message
    const ctx = msg?.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
        return ctx.mentionedJid[0]; // First mention
    }

    // Check for raw number in args
    if (args.length > 0) {
        const num = args[args.length - 1].replace(/\D/g, '');
        if (num.length >= 6) {
            return `${num}@s.whatsapp.net`;
        }
    }

    // Check for quoted message
    if (ctx?.participant) {
        return ctx.participant;
    }

    return null;
}

module.exports = {
    name: 'report',
    aliases: ['reportuser', 'reportcontact'],
    description: 'Report a contact and optionally block them',
    category: 'admin',

    async execute({ sock, msg, args, reply, isOwner, isGroupAdmin, from, sender, isGroup }) {
        try {
            // Check if admin or owner
            if (!isOwner && !isGroupAdmin && isGroup) {
                return reply('❌ *Admin Only!*\n\nYou need to be a group admin to use this command.');
            }

            const firstArg = args[0];

            // Handle group report
            if (firstArg && firstArg.toLowerCase() === 'group') {
                const groupId = args[1];
                if (!groupId) {
                    return reply('❌ Usage: .report group <groupId>');
                }

                try {
                    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});
                    
                    // Report group
                    await sock.reportGroup(groupId);
                    console.log(`[report] Reported group: ${groupId}`);

                    // Leave group
                    await sock.groupLeave(groupId);
                    console.log(`[report] Left group: ${groupId}`);

                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
                    reply(`✅ *Reported and left group* ${groupId}`);
                } catch (e) {
                    console.error('[report] Group report error:', e.message);
                    reply(`❌ Error: ${e.message}`);
                }
                return;
            }

            // Determine report count (default 1)
            let reportCount = 1;
            let targetArgIndex = 0;

            if (firstArg && /^\d+$/.test(firstArg)) {
                reportCount = parseInt(firstArg);
                targetArgIndex = 1;
            }

            // Extract target contact
            const target = extractTarget(msg, args.slice(targetArgIndex));

            if (!target) {
                return reply('❌ *Usage:*\n\n.report @user\n.report 2348012345678\n.report 2 @user\n.report 3 @user\n\n.report group <groupId>');
            }

            const contactNum = target.split('@')[0];

            try {
                await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

                // Report contact multiple times
                for (let i = 0; i < reportCount; i++) {
                    try {
                        await sock.reportContact(target);
                        console.log(`[report] Reported ${contactNum} (${i + 1}/${reportCount})`);
                    } catch (e) {
                        console.log(`[report] Report attempt ${i + 1} failed: ${e.message}`);
                    }

                    // Delay between reports
                    if (i < reportCount - 1) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }

                // Block after first report
                try {
                    await sock.updateBlockStatus(target, 'block');
                    console.log(`[report] Blocked ${contactNum}`);
                } catch (e) {
                    console.log(`[report] Block failed: ${e.message}`);
                }

                // If count >= 2, unblock after all reports
                if (reportCount >= 2) {
                    await new Promise(r => setTimeout(r, 1000));
                    try {
                        await sock.updateBlockStatus(target, 'unblock');
                        console.log(`[report] Unblocked ${contactNum}`);
                    } catch (e) {
                        console.log(`[report] Unblock failed: ${e.message}`);
                    }
                }

                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});

                let statusText = `✅ *Reported ${contactNum}* (×${reportCount})\n\n`;
                if (reportCount === 1) {
                    statusText += '🔒 Status: Blocked';
                } else {
                    statusText += '🔓 Status: Block → Unblock';
                }

                reply(statusText);

            } catch (err) {
                console.error('[report]', err.message);
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                reply(`❌ Error: ${err.message}`);
            }

        } catch (err) {
            console.error('[report] Execute error:', err.message);
            reply(`❌ Error: ${err.message}`);
        }
    }
};
