/**
 * Facebook Video Downloader Command
 * Bulletproof Version 2.0 by Manus (July 2026)
 * Usage: .fb <url>
 */

const axios = require('axios');

module.exports = {
    name: 'facebook',
    aliases: ['fb', 'fbdl', 'fbvideo'],
    description: 'Download Facebook videos/reels with maximum reliability',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        const url = args[0];
        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return reply('🎬 *FACEBOOK DOWNLOADER*\n\nPlease provide a valid Facebook video or reel URL.\nExample: .fb https://www.facebook.com/reel/123456789/');
        }

        try {
            await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } });
            await reply('⏳ *Analyzing Facebook link...* Using multi-stage robust engines.');

            let videoUrl = null;
            let usedEngine = '';

            // --- STAGE 1: SUPER-DOWNLOADER API (Highly Reliable) ---
            try {
                console.log('[fb] Trying Super-Downloader API...');
                const res = await axios.get(`https://api.maher-zubair.tech/download/facebook?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                if (res.data.status && res.data.result) {
                    videoUrl = res.data.result.hd || res.data.result.sd || res.data.result.url;
                    if (videoUrl) usedEngine = 'Maher AI Engine';
                }
            } catch (e) {
                console.error('[fb] Maher AI failed:', e.message);
            }

            // --- STAGE 2: PREXZY API (Fallback) ---
            if (!videoUrl) {
                try {
                    console.log('[fb] Trying Prexzy API...');
                    const res = await axios.get(`https://prexzyapis.com/media/facebook?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    if (res.data.status) {
                        videoUrl = res.data.result || res.data.url || (res.data.data && res.data.data.url);
                        if (videoUrl) usedEngine = 'Prexzy Engine';
                    }
                } catch (e) {
                    console.error('[fb] Prexzy API failed:', e.message);
                }
            }

            // --- STAGE 3: SIPUTZX API (Fallback) ---
            if (!videoUrl) {
                try {
                    console.log('[fb] Trying Siputzx API...');
                    const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    if (res.data.status && res.data.data) {
                        videoUrl = res.data.data.url || res.data.data.hd || res.data.data.sd;
                        if (videoUrl) usedEngine = 'Siputzx Engine';
                    }
                } catch (e) {
                    console.error('[fb] Siputzx failed:', e.message);
                }
            }

            // --- STAGE 4: ALL-IN-ONE DOWNLOADER (Last Resort) ---
            if (!videoUrl) {
                try {
                    console.log('[fb] Trying All-in-One Downloader...');
                    const res = await axios.get(`https://api.vreden.my.id/api/facebook?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    if (res.data.status && res.data.result) {
                        videoUrl = res.data.result.hd || res.data.result.sd || res.data.result.url;
                        if (videoUrl) usedEngine = 'Vreden Engine';
                    }
                } catch (e) {
                    console.error('[fb] Vreden failed:', e.message);
                }
            }

            // --- FINAL DELIVERY ---
            if (!videoUrl) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ *ERROR:* All Facebook download engines are currently unavailable.\n\nPossible reasons:\n1. Video is private or deleted.\n2. API limits reached.\n3. Servers are down.\n4. Invalid link format.');
            }

            // Clean up the URL if it's an object or has extra characters
            const finalUrl = typeof videoUrl === 'string' ? videoUrl : (videoUrl.hd || videoUrl.sd || videoUrl[0]);

            await sock.sendMessage(from, {
                video: { url: finalUrl },
                mimetype: 'video/mp4',
                caption: `🎬 *FACEBOOK DOWNLOADER*\n\n🔗 *URL:* ${url}\n🚀 *Engine:* ${usedEngine}\n\n> Powered by SUKUNA MD`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[fb] Fatal Error:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply(`❌ *FATAL ERROR:* ${err.message || 'The command encountered an unexpected error.'}`);
        }
    },
};
