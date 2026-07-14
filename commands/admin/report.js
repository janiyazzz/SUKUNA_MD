/**
 * Report Command — Report and block WhatsApp contacts
 * Usage:
 *   .report @user            (tag a user)
 *   .report 2348012345678    (raw number)
 *   .report 2 @user          (report twice, blocks and then unblocks once)
 *   .report 3 @user          (report 3 times)
 *   .report group            (show report group subcommand)
 *   .report group <groupId>  (report a group and leave)
 */

const database = require('../../utils/database');

function extractTarget(msg, args, startIndex = 0) {
    // 1) Mentions
    const ctx = msg?.message?.extendedTextMessage?.contextInfo;
    const mentioned = ctx?.mentionedJid?.[startIndex] || ctx?.mentionedJid?.[0];
    if (mentioned) return mentioned;

    // 2) Quoted reply
    const quotedParticipant = ctx?.participant;
    if (quotedParticipant && !args[0]) return quotedParticipant;

    // 3) Raw number argument
    const rawNum = args[startIndex] || args[0];
    if (rawNum) {
        const num = rawNum.replace(/\D/g, '');
        if (num.length >= 6) return `${num}@s.whatsapp.net`;
    }
    return null;
}

async function reportAndBlock(sock, target, count, reply) {
    const num = target.split('@')[0].split(':')[0];
    
    try {
        // Report the contact 'count' times
        for (let i = 0; i < count; i++) {
            try {
                await sock.reportContact(target);
                console.log(`[REPORT] Reported ${num} (${i + 1}/${count})`);
            } catch (e) {
                console.log(`[REPORT] Report attempt ${i + 1} failed: ${e.message}`);
            }
            
            // Small delay between reports
            if (i < count - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // Block after first report
        try {
            await sock.updateBlockStatus(target, 'block');
            console.log(`[REPORT] Blocked ${num}`);
        } catch (e) {
            console.log(`[REPORT] Block failed: ${e.message}`);
        }

        // If count is 2 or more, unblock after count-1 reports
        if (count >= 2) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                await sock.updateBlockStatus(target, 'unblock');
                console.log(`[REPORT] Unblocked ${num} (count=${count})`);
            } catch (e) {
                console.log(`[REPORT] Unblock failed: ${e.message}`);
            }
        }

        // Store report count in database
        if (!database.data.reports) database.data.reports = {};
        database.data.reports[num] = (database.data.reports[num] || 0) + count;
        database.save('data');

        return {
            success: true,
            num,
            count,
            blocked: count === 1
        };
    } catch (err) {
        console.error('[REPORT]', err);
        throw err;
    }
}

module.exports = {
    name: 'report',
    aliases: ['reportuser', 'reportcontact'],
    description: 'Report a WhatsApp contact to WhatsApp and optionally block them',
    category: 'admin',
    async execute({ sock, msg, args, reply, isOwner, isGroupAdmin, from, sender }) {
        try {
            // Check permissions
            if (!isOwner && !isGroupAdmin) {
                return reply('🛡️ *Admin Only!*\n\n❌ Only group admins or the bot owner can report contacts.');
            }

            // Handle .report group subcommand
            if (args[0] && args[0].toLowerCase() === 'group') {
                const groupId = args[1];
                if (!groupId) {
                    return reply(
                        `╔══════════════════════════════╗\n` +
                        `║  📋 *REPORT GROUP*             ║\n` +
                        `╚══════════════════════════════╝\n\n` +
                        `*Usage:*\n` +
                        `▸ .report group <groupId>\n\n` +
                        `_Reports the group to WhatsApp and leaves._`
                    );
                }

                try {
                    // Report the group
                    await sock.reportGroup(groupId);
                    console.log(`[REPORT] Reported group ${groupId}`);

                    // Leave the group
                    await sock.groupLeave(groupId);
                    console.log(`[REPORT] Left group ${groupId}`);

                    return reply(
                        `╔══════════════════════════════╗\n` +
                        `║  📋 *GROUP REPORTED*           ║\n` +
                        `╚══════════════════════════════╝\n\n` +
                        `✅ Group has been reported to WhatsApp.\n` +
                        `👋 Bot has left the group.`
                    );
                } catch (err) {
                    console.error('[REPORT GROUP]', err);
                    return reply(`❌ Failed to report group: ${err.message}`);
                }
            }

            // Parse report count (default 1)
            let count = 1;
            let targetIndex = 0;

            const firstArg = args[0];
            if (firstArg && !isNaN(firstArg) && parseInt(firstArg) > 0) {
                count = Math.min(parseInt(firstArg), 10); // Max 10 reports
                targetIndex = 1;
            }

            // Extract target from mentions, reply, or raw number
            let target = extractTarget(msg, args, targetIndex);
            
            if (!target) {
                return reply(
                    `╔══════════════════════════════╗\n` +
                    `║  📋 *REPORT COMMAND*           ║\n` +
                    `╚══════════════════════════════╝\n\n` +
                    `*Usage:*\n` +
                    `▸ .report @user — report and block\n` +
                    `▸ .report 2 @user — report 2x (block then unblock)\n` +
                    `▸ .report 3345678901 — raw number\n` +
                    `▸ .report group <id> — report group and leave\n\n` +
                    `_Higher counts will still result in blocking after first report,\n` +
                    `then unblocking after count reaches 2+._`
                );
            }

            // Send processing message
            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // Execute report
            const result = await reportAndBlock(sock, target, count, reply);

            // Send success message
            const message =
                `╔══════════════════════════════╗\n` +
                `║  📋 *CONTACT REPORTED*        ║\n` +
                `╚══════════════════════════════╝\n\n` +
                `✅ *+${result.num}* has been reported ${count} time${count > 1 ? 's' : ''}.\n` +
                `${result.blocked ? '🔒 Contact has been *blocked*.' : '🔓 Contact has been *unblocked*.'}`;

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            return reply(message, { mentions: [target] });

        } catch (err) {
            console.error('[REPORT]', err);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            return reply(`❌ Failed to report: ${err.message}`);
        }
    }
};
