/**
 * Instagram Command — Download Instagram media
 * Usage: .instagram <url>
 */

const https = require('https');

function downloadInsta(url) {
    return new Promise((resolve, reject) => {
        const apiUrl = `https://api.neoxr.eu/api/ig?url=${encodeURIComponent(url)}&apikey=your_api_key`;
        https.get(apiUrl, { timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'igdl'],
    description: 'Download Instagram photos/videos',
    category: 'media',
    async execute({ sock, msg, from, reply, args }) {
        if (!args.length) {
            return reply(
                `📸 *Instagram Downloader*\n\n` +
                `Usage: .instagram <post url>\n` +
                `Example: .instagram https://instagram.com/p/ABC123`
            );
        }

        const url = args[0];
        
        if (!url.includes('instagram.com')) {
            return reply('❌ Please provide a valid Instagram URL.');
        }

        try {
            await reply('⏳ Downloading from Instagram...');
            
            // Use a simpler approach - direct download API
            const apiUrl = `https://api.lolhuman.xyz/api/instagram?apikey=free&url=${encodeURIComponent(url)}`;
            
            https.get(apiUrl, { timeout: 30000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', async () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.status === 200 && result.result) {
                            const mediaUrl = Array.isArray(result.result) ? result.result[0] : result.result;
                            
                            if (mediaUrl.includes('.mp4')) {
                                await sock.sendMessage(from, {
                                    video: { url: mediaUrl },
                                    caption: '📸 *Instagram Video*'
                                }, { quoted: msg });
                            } else {
                                await sock.sendMessage(from, {
                                    image: { url: mediaUrl },
                                    caption: '📸 *Instagram Photo*'
                                }, { quoted: msg });
                            }
                        } else {
                            reply('❌ Failed to download. The post might be private or the URL is invalid.');
                        }
                    } catch (e) {
                        reply('❌ Failed to process the Instagram URL. Please try again.');
                    }
                });
            }).on('error', () => {
                reply('❌ Failed to download from Instagram. Please try again later.');
            });
        } catch (err) {
            reply('❌ An error occurred while downloading.');
        }
    }
};
