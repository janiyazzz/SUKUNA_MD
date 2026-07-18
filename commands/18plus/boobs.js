const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'boobs',
    aliases: ['tits'],
    endpoint: 'https://prexzyapis.com/nsfw/boobs',
    emoji: '🍒',
    label: 'Boobs',
});
