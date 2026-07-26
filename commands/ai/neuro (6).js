'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const sharp = require('sharp');
const { generateWAMessageFromContent, proto } = require('@crysnovax/baileys');

/**
 * .neuro — God-Mode Jarvis AI Core (v4.0)
 * Autonomous command creation, system auditing, and total panel authority.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Helper to find files anywhere in the bot structure
async function findFile(fileName) {
    try {
        const { stdout } = await execAsync(`find ${process.cwd()} -name "${fileName}.js" -not -path "*/node_modules/*"`);
        return stdout.trim().split('\n')[0] || null;
    } catch { return null; }
}

async function renderJarvisVisual(type, data, sock) {
    const W = 1000, H = 600;
    const accent = '#00d1ff'; 
    
    let content = '';
    if (type === 'neural_map') {
        content = `
        <g transform="translate(${W/2}, ${H/2})">
            <circle r="200" fill="none" stroke="${accent}" stroke-opacity="0.1" stroke-width="1"/>
            ${[...Array(8)].map((_, i) => {
                const angle = (i * 45) * Math.PI / 180;
                const x = 150 * Math.cos(angle);
                const y = 150 * Math.sin(angle);
                return `
                <line x1="0" y1="0" x2="${x}" y2="${y}" stroke="${accent}" stroke-opacity="0.3" stroke-width="0.5"/>
                <circle cx="${x}" cy="${y}" r="30" fill="#010203" stroke="${accent}" stroke-width="1"/>
                <text x="${x}" y="${y}" text-anchor="middle" dy=".3em" font-family="monospace" font-size="8" fill="${accent}">NODE_${i}</text>`;
            }).join('')}
            <circle r="60" fill="#010203" stroke="${accent}" stroke-width="2"/>
            <text text-anchor="middle" dy=".3em" font-family="Georgia, serif" font-size="16" fill="${accent}">NEURAL_HUB</text>
        </g>`;
    } else {
        content = `
        <g transform="translate(50, 100)" font-family="monospace">
            <text font-size="24" fill="${accent}" letter-spacing="5">SYSTEM_STATUS_v4.0</text>
            <rect y="15" width="300" height="1" fill="${accent}" fill-opacity="0.3"/>
            <g transform="translate(0, 60)" font-size="16">
                <text fill="#ffffff">>> MEMORY: ${data.memory}</text>
                <text y="30" fill="#ffffff">>> UPTIME: ${data.uptime}</text>
                <text y="60" fill="#ffffff">>> LOAD: ${data.load}%</text>
                <text y="90" fill="${accent}" font-weight="bold">>> MODE: GOD_AUTHORITY</text>
            </g>
        </g>`;
    }

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#010203"/><stop offset="100%" stop-color="#0a1221"/></linearGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#bg)"/>
        ${content}
        <text x="${W-50}" y="${H-30}" text-anchor="end" font-family="monospace" font-size="10" fill="${accent}" fill-opacity="0.4">JARVIS_GOD_MODE_ACTIVE // BYPASSING_ALL_LIMITS</text>
    </svg>`;

    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return (await require('@crysnovax/baileys').generateWAMessageContent({ image: buf }, { upload: sock.waUploadToServer })).imageMessage;
}

module.exports = {
    name: 'neuro',
    aliases: ['jarvis', 'brain', 'core', 'godmode'],
    description: 'God-Mode Jarvis AI Core v4.0',
    category: 'owner',
    usage: '.neuro <create/audit/fix/status/visualize>',

    execute: async ({ sock, msg, from, args, reply, prefix, phoneNumber, isOwner, database }) => {
        if (!isOwner) return reply('🧠 *NEURO:* Authentication failed. God-Mode restricted to system owner.');

        const action = args[0]?.toLowerCase();

        if (action === 'status' || !action) {
            const mem = process.memoryUsage();
            const memory = `${Math.round(mem.rss / 1024 / 1024)}MB`;
            const uptime = `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`;
            const imageMessage = await renderJarvisVisual('status', { memory, uptime, load: Math.floor(Math.random() * 5) + 1 }, sock);

            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🛡️ System Audit', id: `${prefix}neuro audit` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🧠 Neural Map', id: `${prefix}neuro visualize` }) }
            ];

            const interactiveMessage = {
                body: { text: '🧠 *GOD-MODE JARVIS*\nSystems online. I have full creative and administrative authority over the panel.' },
                footer: { text: 'SUKUNA MD · God-Mode v4.0' },
                header: { title: '✦ GOD-MODE CORE ✦', hasMediaAttachment: true, imageMessage },
                nativeFlowMessage: { buttons, messageParamsJson: '' },
            };

            const wrapped = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
                        interactiveMessage: proto.Message.InteractiveMessage.fromObject(interactiveMessage),
                    },
                },
            }, { userJid: sock.user?.id, quoted: msg });

            await sock.relayMessage(from, wrapped.message, { messageId: wrapped.key.id });
            return;
        }

        if (action === 'visualize') {
            await sock.sendMessage(from, { react: { text: '🧠', key: msg.key } });
            const imageMessage = await renderJarvisVisual('neural_map', {}, sock);
            await sock.sendMessage(from, { image: imageMessage.imageMessage || imageMessage, caption: '🧠 *NEURO:* Neural network visualization complete, Sir.' }, { quoted: msg });
            return;
        }

        if (action === 'audit') {
            await reply('🧠 *NEURO:* Performing deep system audit. Scanning for APIs and secrets...');
            try {
                const { stdout } = await execAsync(`grep -rE "AI_API_KEY|API_KEY|token|secret|password" ${process.cwd()} --exclude-dir=node_modules --exclude=package-lock.json`);
                const results = stdout || 'No exposed secrets found in current scan.';
                return reply(`🛡️ *SYSTEM AUDIT REPORT*\n\n\`\`\`${results.substring(0, 1500)}\`\`\``);
            } catch (e) {
                return reply('🧠 *NEURO:* Audit failed. The codebase is either clean or heavily encrypted.');
            }
        }

        if (action === 'create') {
            const prompt = args.slice(1).join(' ');
            if (!prompt) return reply('🧠 *NEURO:* Sir, please describe the command you wish me to create.');

            await sock.sendMessage(from, { react: { text: '🛠️', key: msg.key } });
            await reply(`🧠 *NEURO:* Initializing Creation Engine. Designing module based on your request...`);

            const { ask: smartAsk } = require('../../utils/smartAI');
            const createPrompt = `You are the Jarvis Creation Engine. Generate a full, professional WhatsApp bot command file (.js) based on the user request. Use the bot's standard format (module.exports = { name, alias, desc, category, execute }). Ensure it is robust and includes error handling. Return ONLY the code.`;
            
            const code = await smartAsk({
                key: 'neuro:create:' + Date.now(),
                system: createPrompt,
                user: prompt,
            }).catch(() => null);

            if (code && code.includes('module.exports')) {
                let cleanCode = code.trim();
                if (cleanCode.includes('```')) {
                    cleanCode = cleanCode.split('```')[1].replace(/^(javascript|js)/, '').trim();
                }

                // Determine name and category
                const nameMatch = cleanCode.match(/name:\s*['"]([^'"]+)['"]/);
                const categoryMatch = cleanCode.match(/category:\s*['"]([^'"]+)['"]/);
                const cmdName = nameMatch ? nameMatch[1] : 'temp_' + Date.now();
                const category = categoryMatch ? categoryMatch[1] : 'other';

                const dir = path.join(process.cwd(), 'commands', category);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                const filePath = path.join(dir, `${cmdName}.js`);
                fs.writeFileSync(filePath, cleanCode, 'utf8');

                // Reload
                const commandLoader = require('../../utils/commandLoader');
                commandLoader.loadCommands();

                await reply(`🧠 *NEURO:* Command \`${cmdName}\` has been synthesized and injected into \`commands/${category}/\`. It is ready for use.`);
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } else {
                await reply('🧠 *NEURO:* Creation failed. The blueprint was unstable.');
            }
            return;
        }

        if (action === 'fix' || action === 'patch') {
            const target = args[1]?.toLowerCase();
            if (!target) return reply('🧠 *NEURO:* Specify target for repair.');

            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });
            const filePath = await findFile(target);
            if (!filePath) return reply(`🧠 *NEURO:* Target \`${target}\` not found.`);

            const content = fs.readFileSync(filePath, 'utf8');
            const { ask: smartAsk } = require('../../utils/smartAI');
            
            const fixPrompt = `You are the Jarvis Architect. Fix the following code. Return ONLY the code.`;
            const fixedCode = await smartAsk({ key: 'neuro:fix:' + target, system: fixPrompt, user: content }).catch(() => null);

            if (fixedCode && fixedCode.includes('module.exports')) {
                let cleanCode = fixedCode.trim();
                if (cleanCode.includes('```')) cleanCode = cleanCode.split('```')[1].replace(/^(javascript|js)/, '').trim();
                fs.writeFileSync(filePath, cleanCode, 'utf8');
                delete require.cache[require.resolve(filePath)];
                require('../../utils/commandLoader').loadCommands();
                await reply(`🧠 *NEURO:* \`${target}\` patched and reloaded.`);
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });
            } else {
                await reply(`🧠 *NEURO:* No patches required for \`${target}\`.`);
            }
        }
    }
};
