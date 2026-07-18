const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'pussy',
    aliases: [],
    endpoint: 'https://prexzyapis.com/nsfw/pussy',
    emoji: '🐱',
    label: 'Pussy',
});
