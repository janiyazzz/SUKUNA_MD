'use strict';

const fontmakerLib = require('../../utils/fontmakerLib');

module.exports = {
    name: 'fontmaker',
    aliases: ['font', 'fonts', 'textfont'],
    description: 'Convert text to different font styles',
    category: 'utility',
    usage: '.fontmaker <number> <text>',

    execute: async (context) => {
        try {
            const { args, reply } = context;

            if (args.length < 2) {
                let list = 'Available Fonts:\n\n';
                const allFonts = fontmakerLib.listAllFonts();
                for (let i = 0; i < allFonts.length; i++) {
                    list += allFonts[i] + '\n';
                    if ((i + 1) % 10 === 0) list += '\n';
                }
                list += '\nUsage: .fontmaker <number> <text>\nExample: .fontmaker 2 hello world';
                return reply(list);
            }

            const fontNumber = parseInt(args[0]);
            const text = args.slice(1).join(' ');

            if (isNaN(fontNumber)) {
                return reply('Font number must be a number');
            }

            if (!fontmakerLib.isValidFont(fontNumber)) {
                return reply(`Invalid font. Choose 1-${fontmakerLib.getMaxFont()}`);
            }

            if (!text || text.trim().length === 0) {
                return reply('Provide text to convert');
            }

            const fontName = fontmakerLib.getFontName(fontNumber);
            const result = fontmakerLib.convert(text, fontNumber);

            return reply(`*${fontName}*\n\n${result}`);
        } catch (err) {
            console.error('[fontmaker]', err.message);
            return context.reply('Error: ' + err.message);
        }
    }
};
