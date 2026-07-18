const axios = require('axios');

module.exports = {
    name: 'dictionary',
    alias: ['dict', 'define', 'meaning'],
    desc: 'Get word definitions and phonetics',
    category: 'Search',

    execute: async (context) => {
        const { sock, msg, from, args, reply } = context;
        
        const word = args[0]?.trim().toLowerCase();
        
        if (!word) {
            return reply(
                `╭─❍ *DICTIONARY*\n` +
                `│\n` +
                `│ ⚉ *Usage:* .dictionary <word>\n` +
                `│\n` +
                `│ ✪ *Examples:*\n` +
                `│ .dictionary hello\n` +
                `│ .dictionary love\n` +
                `│ .dictionary serendipity\n` +
                `│\n` +
                `│ 📖 *Free Dictionary API*\n` +
                `╰──────────────────`
            );
        }

        try {
            await sock.sendMessage(from, { react: { text: '📖', key: msg.key } });

            const res = await axios.get(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
                {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                }
            );

            const data = res.data?.[0];
            if (!data) {
                await sock.sendMessage(from, { react: { text: '❔', key: msg.key } });
                return reply(`No definition found for "${word}"`);
            }

            // Extract phonetics
            const phonetics = data.phonetics
                ?.map(p => p.text)
                .filter(Boolean)
                .join(', ') || 'N/A';
            const audioUrl = data.phonetics?.find(p => p.audio)?.audio || '';

            // Get first meaning group
            const meaning = data.meanings?.[0];
            const partOfSpeech = meaning?.partOfSpeech || 'N/A';
            const definition = meaning?.definitions?.[0]?.definition || 'No definition';
            const example = meaning?.definitions?.[0]?.example || 'No example';
            const synonyms = meaning?.synonyms?.slice(0, 5).join(', ') || 'None';
            const antonyms = meaning?.antonyms?.slice(0, 5).join(', ') || 'None';

            // Build formatted response
            let responseText = `╭─❍ *DICTIONARY*\n│\n`;
            responseText += `│ 📖 *Word:* ${data.word}\n`;
            responseText += `│ 🔊 *Phonetic:* ${phonetics}\n`;
            responseText += `│ 📝 *Type:* ${partOfSpeech}\n`;
            responseText += `│\n`;
            responseText += `│ 📚 *Definition:*\n`;
            responseText += `│ ${definition}\n`;
            responseText += `│\n`;
            responseText += `│ 💬 *Example:*\n`;
            responseText += `│ ${example}\n`;
            responseText += `│\n`;
            responseText += `│ 🟢 *Synonyms:*\n`;
            responseText += `│ ${synonyms}\n`;
            responseText += `│\n`;
            responseText += `│ 🔴 *Antonyms:*\n`;
            responseText += `│ ${antonyms}\n`;

            if (audioUrl) {
                responseText += `│\n│ 🔊 *Audio:* ${audioUrl}\n`;
            }

            responseText += `│\n`;
            responseText += `╰──────────────────`;

            await sock.sendMessage(from, { text: responseText }, { quoted: msg });

            // Success reaction
            await sock.sendMessage(from, { react: { text: '✨', key: msg.key } });

        } catch (error) {
            console.error('[dictionary]', error.message);
            await sock.sendMessage(from, { react: { text: '❔', key: msg.key } });
            reply('Failed to fetch definition');
        }
    }
};
