const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'pussy',
    aliases: [],
    endpoint: 'https://apis.prexzyvilla.site/nsfw/pussy',
    emoji: '🐱',
    label: 'Pussy',
});
