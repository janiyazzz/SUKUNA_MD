/**
 * .approve all          — approve every pending join request
 * .approve <N>          — approve only the first N pending requests
 * .approve              — show current pending count and usage
 */

async function approveInBatches(sock, from, ids, batchSize = 50) {
    let approved = 0;
    const failed = [];
    for (let i = 0; i < ids.length; i += batchSize) {
        const chunk = ids.slice(i, i + batchSize);
        try {
            const res = await sock.groupRequestParticipantsUpdate(from, chunk, 'approve');
            // res is an array of { jid, status } — count successes if shape matches
            if (Array.isArray(res)) {
                approved += res.filter(r => String(r.status) === '200' || r.status === 200).length;
            } else {
                approved += chunk.length;
            }
        } catch (err) {
            failed.push({ chunk, error: err.message });
        }
    }
    return { approved, failed };
}

module.exports = {
    name: 'approve',
    description: 'Approve pending group join requests (.approve all | .approve <N>)',
    category: 'admin',

    async execute({ sock, reply, args, from, isGroup, isAdmin }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!isAdmin) return reply('🔒 Admins only.');

        let pending;
        try {
            pending = await sock.groupRequestParticipantsList(from);
        } catch (err) {
            return reply(`❌ Couldn't fetch join requests: ${err.message}`);
        }

        const total = pending?.length || 0;

        if (!args[0]) {
            return reply(
                `📋 *Pending join requests:* ${total}\n\n` +
                `Usage:\n` +
                `• *.approve all* — approve every pending request\n` +
                `• *.approve <N>* — approve only the first N requests`
            );
        }

        if (total === 0) return reply('✅ No pending join requests.');

        const arg = args[0].toLowerCase();
        let take;
        if (arg === 'all') {
            take = total;
        } else {
            const n = parseInt(arg, 10);
            if (!Number.isFinite(n) || n <= 0) {
                return reply('❌ Usage: *.approve all* or *.approve <number>*');
            }
            take = Math.min(n, total);
        }

        const ids = pending.slice(0, take).map(r => r.jid);
        await reply(`⏳ Approving *${ids.length}* of *${total}* pending requests...`);

        const { approved, failed } = await approveInBatches(sock, from, ids);

        let summary = `✅ *Approval complete.*\n\nRequested: *${ids.length}*\nApproved: *${approved}*\nRemaining pending: *${total - approved}*`;
        if (failed.length) {
            summary += `\nFailed batches: ${failed.length}\nFirst error: ${failed[0].error}`;
        }
        await reply(summary);
    }
};
