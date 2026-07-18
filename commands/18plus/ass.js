const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'ass',
    aliases: [],
    endpoint: 'https://prexzyapis.com/nsfw/ass',
    emoji: '🍑',
    label: 'Ass',
});
