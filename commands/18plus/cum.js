const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'cum',
    aliases: [],
    endpoint: 'https://prexzyapis.com/nsfw/cum',
    emoji: '💦',
    label: 'Cum',
});
