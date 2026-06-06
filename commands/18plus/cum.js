const { makeNsfwCommand } = require('../../lib/nsfwFetch');
module.exports = makeNsfwCommand({
    name: 'cum',
    aliases: [],
    endpoint: 'https://apis.prexzyvilla.site/nsfw/cum',
    emoji: '💦',
    label: 'Cum',
});
