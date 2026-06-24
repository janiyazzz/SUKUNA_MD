/**
 * Link Command — Get group invite link with rich WhatsApp invite card
 * Usage: .link  (group admins only)
 *
 * Sends the invite as a groupInviteMessage so it renders as the native
 * "Group chat invite" card with group picture, name and "Join group" button.
 *
 * Also sends a richPreview text link with a sharp, full-resolution preview
 * image fetched directly from the OG meta tags — not WhatsApp's blurry
 * auto-thumbnail.
 */

// Fetch OG image at full resolution from a URL
async function fetchOgImage(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A', Accept: 'text/html' },
            redirect: 'follow',
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const html = await res.text();
        const imgUrl =
            html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
        if (!imgUrl) return null;
        const absImg = imgUrl.startsWith('http') ? imgUrl : new URL(imgUrl, url).href;
        const imgCtrl = new AbortController();
        const imgTimer = setTimeout(() => imgCtrl.abort(), 12_000);
        const imgRes = await fetch(absImg, {
            signal: imgCtrl.signal,
            headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' },
        });
        clearTimeout(imgTimer);
        if (!imgRes.ok) return null;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return buf.length > 1000 ? buf : null;
    } catch (_) { return null; }
}

module.exports = {
    name: 'link',
    aliases: ['grouplink', 'invitelink'],
    description: 'Get the group invite link as a rich invite card (admin only)',
    category: 'group',

    async execute({ sock, msg, from, reply, isGroup, isAdmin }) {
        if (!isGroup) return reply('👥 This command can only be used in groups!');
        if (!isAdmin) return reply('🛑 Only group admins can fetch the invite link.');

        try {
            const [groupMetadata, inviteCode] = await Promise.all([
                sock.groupMetadata(from),
                sock.groupInviteCode(from),
            ]);

            const groupName = groupMetadata.subject || 'Group';
            const memberCount = groupMetadata.participants?.length || 0;
            const inviteUrl = `https://chat.whatsapp.com/${inviteCode}`;

            // Fetch group picture for the card thumbnail (used in both the invite card
            // and as the rich preview image — fetched at full res directly from WA CDN)
            let jpegThumbnail = null;
            try {
                const ppUrl = await sock.profilePictureUrl(from, 'image');
                if (ppUrl) {
                    const res = await fetch(ppUrl);
                    if (res.ok) {
                        jpegThumbnail = Buffer.from(await res.arrayBuffer());
                    }
                }
            } catch (_) {}

            // Also try to get a sharper OG image from the invite link itself
            // (WhatsApp's own invite pages serve the group photo via og:image)
            let ogImage = null;
            try { ogImage = await fetchOgImage(inviteUrl); } catch (_) {}
            // Prefer OG image (full-res from WA servers) over the CDN thumbnail
            const previewImage = ogImage || jpegThumbnail;

            // ── 1. Native invite card (groupInviteMessage) ──────────────────
            // Renders as the "Group chat invite" bubble with photo + Join button.
            await sock.sendMessage(from, {
                groupInviteMessage: {
                    inviteCode,
                    inviteExpiration: Math.floor(Date.now() / 1000) + 86400 * 3,
                    groupJid:  from,
                    groupName,
                    ...(jpegThumbnail ? { jpegThumbnail } : {}),
                },
            }, { quoted: msg });

            // ── 2. Rich URL preview link with sharp, full-res image ──────────
            // Providing previewImage as a Buffer overrides WhatsApp's auto-fetch
            // (which tends to produce blurry 100px thumbnails).
            await sock.sendMessage(from, {
                text:               inviteUrl,
                richPreview:        true,
                previewTitle:       groupName,
                previewDescription: `${memberCount} members · Tap to join`,
                ...(previewImage ? { previewImage } : {}),
            }, { quoted: msg });

        } catch (err) {
            console.error('[LINK CMD]', err.message);
            try {
                const inviteCode = await sock.groupInviteCode(from);
                await sock.sendMessage(from, {
                    text:        `https://chat.whatsapp.com/${inviteCode}`,
                    richPreview: true,
                }, { quoted: msg }).catch(() =>
                    reply(`🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${inviteCode}\n\n⚠️ Share responsibly!`)
                );
            } catch (e2) {
                reply('❌ Failed to get invite link. Make sure I am a group admin.');
            }
        }
    }
};
