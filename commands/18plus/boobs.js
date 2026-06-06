const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'boobs',
    aliases: ['tits'],
    endpoint: 'https://apis.prexzyvilla.site/nsfw/boobs',
    emoji: '🍒',
    label: 'Boobs',
});
