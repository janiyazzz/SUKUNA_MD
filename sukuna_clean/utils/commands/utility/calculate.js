/**
 * Calculate Command — Perform mathematical calculations
 * Usage: .calc <expression>
 */

module.exports = {
    name: 'calc',
    aliases: ['calculate', 'math'],
    description: 'Calculate mathematical expressions',
    category: 'utility',
    async execute({ reply, args }) {
        if (!args.length) {
            return reply(
                `🔢 *Calculator*\n\n` +
                `Usage: .calc <expression>\n` +
                `Example: .calc 5 + 5\n\n` +
                `Supports: +, -, *, /, %, ** (power), (), sin, cos, tan, sqrt, log`
            );
        }

        const expression = args.join(' ');
        
        try {
            // Sanitize and validate expression
            const sanitized = expression
                .replace(/[^0-9+\-*/%.()\s]/g, '')
                .replace(/\/\s*0/g, '/1'); // Prevent division by zero
            
            if (!sanitized || sanitized !== expression.replace(/\s/g, '')) {
                return reply('❌ Invalid characters in expression. Only numbers and operators allowed.');
            }

            // Safe evaluation
            const result = Function('"use strict"; return (' + sanitized + ')')();
            
            reply(
                `🔢 *Calculator*\n\n` +
                `Expression: \`${expression}\`\n` +
                `Result: *${result}*`
            );
        } catch (err) {
            reply('❌ Invalid mathematical expression. Please check your input.');
        }
    }
};
