/**
 * YouTube Command — Search YouTube videos
 * Usage: .youtube <search query>
 */

const https = require('https');

function searchYouTube(query) {
    return new Promise((resolve, reject) => {
        // Using invidious API (privacy-friendly YouTube alternative)
        const url = `https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}`;
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const results = JSON.parse(data);
                    resolve(results.slice(0, 5));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'youtube',
    aliases: ['yt', 'ytsearch'],
    description: 'Search YouTube videos',
    category: 'media',
    async execute({ reply, args }) {
        if (!args.length) {
            return reply(
                `📺 *YouTube Search*\n\n` +
                `Usage: .youtube <search query>\n` +
                `Example: .youtube never gonna give you up`
            );
        }

        const query = args.join(' ');
        
        try {
            await reply(`🔍 Searching YouTube for: *${query}*...`);
            const results = await searchYouTube(query);
            
            if (!results || results.length === 0) {
                return reply('❌ No results found. Try a different search term.');
            }

            let response = `📺 *YouTube Results*\n\n`;
            results.forEach((video, index) => {
                const title = video.title || 'Unknown Title';
                const author = video.author || 'Unknown';
                const views = video.viewCount ? `👁️ ${(video.viewCount / 1000).toFixed(1)}K` : '';
                const duration = video.lengthSeconds ? `⏱️ ${Math.floor(video.lengthSeconds / 60)}:${(video.lengthSeconds % 60).toString().padStart(2, '0')}` : '';
                
                response += `${index + 1}. *${title}*\n`;
                response += `   👤 ${author} ${views} ${duration}\n`;
                response += `   🔗 https://youtube.com/watch?v=${video.videoId}\n\n`;
            });

            reply(response);
        } catch (err) {
            reply('❌ Failed to search YouTube. Please try again later.');
        }
    }
};
