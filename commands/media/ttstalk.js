/**
 * .ttstalk <username> — get info on a TikTok account
 *
 * Provider: apis.prexzyvilla.site/stalk/ttstalk. Response shape was never
 * confirmed live (every test request 400'd with no visible body), so
 * fields are pulled defensively via a wide list of plausible names rather
 * than assuming one exact shape, following the same pattern already used
 * in commands/media/tiktok.js for this codebase's other TikTok endpoint.
 */
'use strict';
const axios = require('axios');

function pick(root, keys) {
    for (const k of keys) {
        const v = root?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
}

function formatCount(n) {
    if (n === null || n === undefined) return null;
    const num = typeof n === 'string' ? parseFloat(n.replace(/[^\d.]/g, '')) : n;
    if (!Number.isFinite(num)) return String(n);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return String(num);
}

module.exports = {
    name: 'ttstalk',
    aliases: ['tiktokstalk', 'ttinfo'],
    description: 'Get info on a TikTok account',
    category: 'media',
    usage: '.ttstalk <username>',

    async execute({ sock, msg, from, reply, args }) {
        const username = (args || []).join(' ').trim().replace(/^@/, '');
        if (!username) {
            return reply(
                `📱 *TikTok Stalk*\n\n` +
                `Usage: .ttstalk <username>\n` +
                `Example: .ttstalk charlidamelio`
            );
        }

        try {
            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } }).catch(() => {});

            const { data } = await axios.get('https://apis.prexzyvilla.site/stalk/ttstalk', {
                params: { user: username },
                timeout: 30000,
                validateStatus: () => true,
            });

            const root = data?.data || data?.result || data || {};

            const nickname   = pick(root, ['nickname', 'name', 'fullName', 'displayName']);
            const handle      = pick(root, ['username', 'unique_id', 'uniqueId', 'user']) || username;
            const bio          = pick(root, ['bio', 'signature', 'desc', 'description']);
            const followers    = pick(root, ['followers', 'followerCount', 'follower_count', 'fans']);
            const following    = pick(root, ['following', 'followingCount', 'following_count']);
            const likes         = pick(root, ['likes', 'heart', 'heartCount', 'likeCount', 'total_favorited']);
            const videoCount   = pick(root, ['videoCount', 'video_count', 'videos', 'awemeCount']);
            const verified       = pick(root, ['verified', 'isVerified']);
            const avatar          = pick(root, ['avatar', 'avatarUrl', 'avatar_url', 'avatarLarger', 'profile_pic']);

            if (!nickname && !followers && !bio) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return reply(`❌ Couldn't find TikTok account *@${username}*. Double-check the username and try again.`);
            }

            let out = `📱 *TikTok Account*\n\n`;
            out += `👤 *${nickname || handle}*${verified ? ' ✅' : ''}\n`;
            out += `🔗 @${handle}\n`;
            if (bio) out += `📝 ${bio}\n`;
            out += `\n`;
            if (followers !== null) out += `👥 Followers: *${formatCount(followers)}*\n`;
            if (following !== null) out += `➡️ Following: *${formatCount(following)}*\n`;
            if (likes !== null) out += `❤️ Likes: *${formatCount(likes)}*\n`;
            if (videoCount !== null) out += `🎥 Videos: *${formatCount(videoCount)}*\n`;

            if (avatar && typeof avatar === 'string' && /^https?:\/\//.test(avatar)) {
                try {
                    await sock.sendMessage(from, { image: { url: avatar }, caption: out }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
                    return;
                } catch (_) { /* fall through to text-only */ }
            }

            await reply(out);
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error('[ttstalk] error:', err.message);
            try { await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }); } catch {}
            reply('❌ TikTok lookup failed. Try again later.');
        }
    },
};
