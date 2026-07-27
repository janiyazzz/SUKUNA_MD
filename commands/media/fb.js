/**
 * Facebook Video Downloader Command
 * Bulletproof Version by Manus (July 2026)
 * Usage: .fb <url>
 */

const axios = require('axios');

module.exports = {
    name: 'facebook',
    aliases: ['fb', 'fbdl'],
    description: 'Download Facebook videos/reels using robust multi-stage fallbacks',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        const url = args[0];
        if (!url || !url.includes('facebook.com') && !url.includes('fb.watch')) {
            return reply('🎬 *FACEBOOK DOWNLOADER*\n\nPlease provide a valid Facebook video or reel URL.\nExample: .fb https://www.facebook.com/reel/123456789/');
        }

        try {
            await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } });
            await reply('⏳ *Processing Facebook video...* Using robust multi-stage engines.');

            let videoData = null;
            let usedEngine = '';

            // --- STAGE 1: PREXZY API ---
            try {
                console.log('[fb] Trying Prexzy API...');
                const res = await axios.get(`https://prexzyapis.com/media/facebook?url=${encodeURIComponent(url)}`, { timeout: 15000 });
                if (res.data.status && (res.data.result || res.data.url)) {
                    videoData = res.data.result || res.data.url;
                    usedEngine = 'Prexzy Engine';
                }
            } catch (e) {
                console.error('[fb] Prexzy API failed:', e.message);
            }

            // --- STAGE 2: MAHER AI API ---
            if (!videoData) {
                try {
                    console.log('[fb] Trying Maher AI API...');
                    const res = await axios.get(`https://api.maher-zubair.tech/download/facebook?url=${encodeURIComponent(url)}`, { timeout: 15000 });
                    if (res.data.status && res.data.result) {
                        videoData = res.data.result.url || res.data.result.hd || res.data.result.sd;
                        usedEngine = 'Maher AI Engine';
                    }
                } catch (e) {
                    console.error('[fb] Maher AI failed:', e.message);
                }
            }

            // --- STAGE 3: SIPUTZX API ---
            if (!videoData) {
                try {
                    console.log('[fb] Trying Siputzx API...');
                    const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, { timeout: 15000 });
                    if (res.data.status && res.data.data) {
                        videoData = res.data.data.url || res.data.data.hd || res.data.data.sd;
                        usedEngine = 'Siputzx Engine';
                    }
                } catch (e) {
                    console.error('[fb] Siputzx failed:', e.message);
                }
            }

            // --- STAGE 4: D-API FALLBACK ---
            if (!videoData) {
                try {
                    console.log('[fb] Trying D-API Fallback...');
                    const res = await axios.get(`https://d-api.com/api/fb?url=${encodeURIComponent(url)}`, { timeout: 15000 });
                    if (res.data.url) {
                        videoData = res.data.url;
                        usedEngine = 'D-API Fallback';
                    }
                } catch (e) {
                    console.error('[fb] D-API failed:', e.message);
                }
            }

            // --- FINAL DELIVERY ---
            if (!videoData) {
                await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
                return reply('❌ *ERROR:* All Facebook download engines are currently unavailable.\n\nPossible reasons:\n1. Video is private or deleted.\n2. API limits reached.\n3. Servers are down.');
            }

            // Ensure videoData is a string (some APIs return an object or array)
            const downloadUrl = typeof videoData === 'string' ? videoData : (videoData.hd || videoData.sd || videoData[0]);

            await sock.sendMessage(from, {
                video: { url: downloadUrl },
                mimetype: 'video/mp4',
                caption: `🎬 *FACEBOOK DOWNLOADER*\n\n🔗 *URL:* ${url}\n🚀 *Engine:* ${usedEngine}\n\n> Powered by SUKUNA MD`,
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('[fb] Fatal:', err.message);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } });
            reply('❌ *FATAL ERROR:* The command encountered an unexpected error.');
        }
    },
};
