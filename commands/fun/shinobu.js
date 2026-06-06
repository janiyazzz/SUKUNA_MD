const { makeAnimeReaction } = require('../../lib/animeReaction');
module.exports = makeAnimeReaction({
    name: 'shinobu', emoji: '🌸', verb: 'sent Shinobu vibes to', selfVerb: 'is feeling Shinobu vibes',
    title: 'SHINOBU',
    fallbacks: [
        'https://media.tenor.com/V8N1cBNkBfsAAAAC/shinobu-shinobu-oshino.gif'
    ],
    description: 'Send a Shinobu reaction GIF'
});
