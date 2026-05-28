/**
 * TikTok Command — Download TikTok videos
 * Usage: .tiktok <url>
 */

const https = require('https');

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'ttdl'],
    description: 'Download TikTok videos without watermark',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `🎵 *TikTok Downloader*\n\n` +
                `Usage: .tiktok <video url>\n` +
                `Example: .tiktok https://tiktok.com/@user/video/123456`
            );
        }

        const url = args[0];
        
        if (!url.includes('tiktok.com')) {
            return reply('❌ Please provide a valid TikTok URL.');
        }

        try {
            await reply('⏳ Downloading TikTok video...');
            
            // Using a free TikTok API
            const apiUrl = `https://api.lolhuman.xyz/api/tiktok?apikey=free&url=${encodeURIComponent(url)}`;
            
            https.get(apiUrl, { timeout: 30000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.status === 200 && result.result) {
                            const videoUrl = result.result.link || result.result.video;
                            const title = result.result.title || 'TikTok Video';
                            const author = result.result.author?.nickname || 'Unknown';
                            
                            if (videoUrl) {
                                await sock.sendMessage(from, {
                                    video: { url: videoUrl },
                                    caption: `🎵 *${title}*\n👤 ${author}\n\n> Downloaded by SUKUNA MD`
                                }, { quoted: msg });
                            } else {
                                reply('❌ Could not extract video URL.');
                            }
                        } else {
                            reply('❌ Failed to download. The video might be private or the URL is invalid.');
                        }
                    } catch (e) {
                        reply('❌ Failed to process the TikTok URL. Please try again.');
                    }
                });
            }).on('error', () => {
                reply('❌ Failed to download from TikTok. Please try again later.');
            });
        } catch (err) {
            reply('❌ An error occurred while downloading.');
        }
    }
};
