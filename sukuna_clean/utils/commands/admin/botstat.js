/**
 * BotStat Command — Canvas bot statistics card
 * Usage: .botstat
 */
const os = require('os');
const config = require('../../config');
const { renderUptimeCard } = require('../../utils/canvasRender');

const fmt = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};

module.exports = {
    name: 'botstat',
    aliases: ['botstats', 'stats'],
    description: 'Show detailed bot and server statistics',
    category: 'admin',
    async execute({ sock, msg, from, reply }) {
        const botUptime = fmt(process.uptime());
        const sysUptime = fmt(os.uptime());
        const platform  = os.platform();
        const arch      = os.arch();
        const totalMem  = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem   = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const botMem    = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const cpus      = os.cpus();
        const cpuModel  = (cpus[0]?.model || 'Unknown').trim().split(/\s+/).slice(0, 4).join(' ');

        try {
            const buf = await renderUptimeCard({
                botUptime, sysUptime, platform, arch,
                totalMem, freeMem, botMem,
                botName: (config.botName || 'SUKUNA · MD').toUpperCase(),
            });
            const caption =
                `📊 *Bot Statistics*\n\n` +
                `🤖 Uptime: *${botUptime}* · 💻 Sys: *${sysUptime}*\n` +
                `💾 RAM: ${freeMem}/${totalMem} GB · Bot: ${botMem} MB\n` +
                `🖥️ ${platform}/${arch} · ${cpus.length} cores\n` +
                `⚙️ ${cpuModel}\n` +
                `🟢 Node ${process.version}`;
            await sock.sendMessage(from, { image: buf, caption }, { quoted: msg });
        } catch (e) {
            reply(
                `📊 *Bot Statistics*\n\n` +
                `🤖 Uptime: ${botUptime}\n` +
                `💻 Sys Uptime: ${sysUptime}\n` +
                `💾 RAM: ${freeMem}/${totalMem} GB · Bot: ${botMem} MB\n` +
                `🖥️ ${platform}/${arch} · ${cpus.length} cores\n` +
                `🟢 Node ${process.version}`
            );
        }
    }
};
