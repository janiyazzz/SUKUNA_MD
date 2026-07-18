'use strict';

// 100 unique font styles for text conversion
const FONTS = {
    1: { name: 'Bold', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗' },
    2: { name: 'Italic', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻0123456789' },
    3: { name: 'Bold Italic', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛0123456789' },
    4: { name: 'Script', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃0123456789' },
    5: { name: 'Bold Script', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃0123456789' },
    6: { name: 'Fraktur', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷0123456789' },
    7: { name: 'Double Struck', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡' },
    8: { name: 'Sans Serif Bold', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵' },
    9: { name: 'Sans Serif Italic', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻0123456789' },
    10: { name: 'Monospace', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝙰𝙱𝐶𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝙾𝙰𝐑𝙼𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿' },
    11: { name: 'Superscript', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᵠᴿˢᵀᵁᴸᵂˣʸᶻᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᵍʳˢᵗᵘᵛʷˣʸᶻ⁰¹²³⁴⁵⁶⁷⁸⁹' },
    12: { name: 'Subscript', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ₐₑᵢₒᵤₓₚₕₗₘₙₛₜᵤᵥₓᵧᵤₐₑᵢₒᵤₓ₀₁₂₃₄₅₆₇₈₉ₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐₐ₀₁₂₃₄₅₆₇₈₉' },
    13: { name: 'Strikethrough', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A̶B̶C̶D̶E̶F̶G̶H̶I̶J̶K̶L̶M̶N̶O̶P̶Q̶R̶S̶T̶U̶V̶W̶X̶Y̶Z̶a̶b̶c̶d̶e̶f̶g̶h̶i̶j̶k̶l̶m̶n̶o̶p̶q̶r̶s̶t̶u̶v̶w̶x̶y̶z̶0̶1̶2̶3̶4̶5̶6̶7̶8̶9̶' },
    14: { name: 'Underline', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A̲B̲C̲D̲E̲F̲G̲H̲I̲J̲K̲L̲M̲N̲O̲P̲Q̲R̲S̲T̲U̲V̲W̲X̲Y̲Z̲a̲b̲c̲d̲e̲f̲g̲h̲i̲j̲k̲l̲m̲n̲o̲p̲q̲r̲s̲t̲u̲v̲w̲x̲y̲z̲0̲1̲2̲3̲4̲5̲6̲7̲8̲9̲' },
    15: { name: 'Overline', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A̅B̅C̅D̅E̅F̅G̅H̅I̅J̅K̅L̅M̅N̅O̅P̅Q̅R̅S̅T̅U̅V̅W̅X̅Y̅Z̅a̅b̅c̅d̅e̅f̅g̅h̅i̅j̅k̅l̅m̅n̅o̅p̅q̅r̅s̅t̅u̅v̅w̅x̅y̅z̅0̅1̅2̅3̅4̅5̅6̅7̅8̅9̅' },
    16: { name: 'Bubble', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉' },
    17: { name: 'Reverse Bubble', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉🅰' },
    18: { name: 'Cursive Italic', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻0123456789' },
    19: { name: 'Gothic', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷0123456789' },
    20: { name: 'Full Width', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Ａ Ｂ Ｃ Ｄ Ｅ Ｆ Ｇ Ｈ Ｉ Ｊ Ｋ Ｌ Ｍ Ｎ Ｏ Ｐ Ｑ Ｒ Ｓ Ｔ Ｕ Ｖ Ｗ Ｘ Ｙ Ｚ ａ ｂ ｃ ｄ ｅ ｆ ｇ ｈ ｉ ｊ ｋ ｌ ｍ ｎ ｏ ｐ ｑ ｒ ｓ ｔ ｕ ｖ ｗ ｘ ｙ ｚ ０ １ ２ ３ ４ ５ ６ ７ ８ ９' },
    21: { name: 'Small Caps', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ᴀ ʙ ᴄ ᴅ ᴇ ꜰ ɢ ʜ ɪ ᴊ ᴋ ʟ ᴍ ɴ ᴏ ᴘ ǫ ʀ ꜱ ᴛ ᴜ ᴠ ᴡ x ʏ ᴢ 0123456789' },
    22: { name: 'Wavy Underline', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A̰B̰C̰D̰ḚF̰G̰H̰ḬJ̰K̰L̰M̰N̰O̰P̰Q̰R̰S̰T̰ṴV̰W̰X̰Y̰Z̰a̰b̰c̰d̰ḛf̰g̰h̰ḭj̰k̰l̰m̰n̰o̰p̰q̰r̰s̰t̰ṵv̰w̰x̰y̰z̰0̰1̰2̰3̰4̰5̰6̰7̰8̰9̰' },
    23: { name: 'Dot Above', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Ȧḃċḋėḟġḣİjḳḷṁṅȯṗq̇ṛṡṫṙṿẇẋẏż0̇1̇2̇3̇4̇5̇6̇7̇8̇9̇' },
    24: { name: 'Parenthesis', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵⓪①②③④⑤⑥⑦⑧⑨' },
    25: { name: 'Circle', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ⓪①②③④⑤⑥⑦⑧⑨' },
    26: { name: 'Square', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣' },
    27: { name: 'Negative Square', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '🆰🆱🆲🆳🆴🆵🆶🆷🆸🆹🆺🆻🆼🆽🆾🆿🇀🇁🇂🇃🇄🇅🇆🇇🇈🇉🆰🆱🆲🆳🆴🆵🆶🆷🆸🆹🆺🆻🆼🆽🆾🆿🇀🇁🇂🇃🇄🇅🇆🇇🇈🇉0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣' },
    28: { name: 'Wave 1', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '𝚨𝚩𝚪𝚫𝚬𝚭𝚮𝚯𝚰𝚱𝚲𝚳𝚴𝚵𝚶𝚷𝚸𝚹𝚺𝚻𝚼𝚽𝚾𝚿𝛀𝛂𝛃𝛄𝛅𝛆𝛇𝛈𝛉𝛊𝛋𝛌𝛍𝛎𝛏𝛐𝛑𝛒𝛓𝛔𝛕𝛖𝛗𝛘𝛙𝛚𝛛' },
    29: { name: 'Math Alpha', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗' },
    30: { name: 'Flower', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹𝑒𝒻𝒼𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝓄𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏' },
    31: { name: 'Upside Down', map: 'abcdefghijklmnopqrstuvwxyz', convert: '∀qɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎz' },
    32: { name: 'Reversed', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz' },
    33: { name: 'Zalgo', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: 'Å̡͊B̴̢̚C̷̤̊D̶̥̓Ḛ̸͝F̶̲̄G̷̡̀H̶̡́I̵̡͐J̶̫̅K̵̛̊L̶̛̏M̸̺̈́N̷͈̏O̷͇̽P̴̭͐Q̸̗̋R̷̼̈S̵̰̈T̶̤̚U̴̧͊V̴̰͐W̶̰̏X̵̯̅Y̶͈̏Z̴̝̐a̵̢͋b̶̻̋c̷̨̾d̸̥̋e̷̳̊f̷͓̀g̸͙̈h̶̲̋i̶̻̾j̷̢̊ǩ̶̦l̴̖̓m̴̤̈n̵̡̏o̴̧̿p̵̜̀q̴̗̾r̶̖̈s̸̱̾t̴̰́u̶̩̐v̵̫̇w̷̘̚x̷̥̽y̴̛̽z̴̪̀' },
    34: { name: 'Angle Brackets', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '❬A❭❬B❭❬C❭❬D❭❬E❭❬F❭❬G❭❬H❭❬I❭❬J❭❬K❭❬L❭❬M❭❬N❭❬O❭❬P❭❬Q❭❬R❭❬S❭❬T❭❬U❭❬V❭❬W❭❬X❭❬Y❭❬Z❭❬a❭❬b❭❬c❭❬d❭❬e❭❬f❭❬g❭❬h❭❬i❭❬j❭❬k❭❬l❭❬m❭❬n❭❬o❭❬p❭❬q❭❬r❭❬s❭❬t❭❬u❭❬v❭❬w❭❬x❭❬y❭❬z❭' },
    35: { name: 'Curly Brackets', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '❰A❱❰B❱❰C❱❰D❱❰E❱❰F❱❰G❱❰H❱❰I❱❰J❱❰K❱❰L❱❰M❱❰N❱❰O❱❰P❱❰Q❱❰R❱❰S❱❰T❱❰U❱❰V❱❰W❱❰X❱❰Y❱❰Z❱❰a❱❰b❱❰c❱❰d❱❰e❱❰f❱❰g❱❰h❱❰i❱❰j❱❰k❱❰l❱❰m❱❰n❱❰o❱❰p❱❰q❱❰r❱❰s❱❰t❱❰u❱❰v❱❰w❱❰x❱❰y❱❰z❱' },
    36: { name: 'Square Brackets', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', convert: '⟦A⟧⟦B⟧⟦C⟧⟦D⟧⟦E⟧⟦F⟧⟦G⟧⟦H⟧⟦I⟧⟦J⟧⟦K⟧⟦L⟧⟦M⟧⟦N⟧⟦O⟧⟦P⟧⟦Q⟧⟦R⟧⟦S⟧⟦T⟧⟦U⟧⟦V⟧⟦W⟧⟦X⟧⟦Y⟧⟦Z⟧⟦a⟧⟦b⟧⟦c⟧⟦d⟧⟦e⟧⟦f⟧⟦g⟧⟦h⟧⟦i⟧⟦j⟧⟦k⟧⟦l⟧⟦m⟧⟦n⟧⟦o⟧⟦p⟧⟦q⟧⟦r⟧⟦s⟧⟦t⟧⟦u⟧⟦v⟧⟦w⟧⟦x⟧⟦y⟧⟦z⟧' },
    37: { name: 'Tilde', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Ã̶B̶C̶D̶Ẽ̶F̶G̶H̶Ĩ̶J̶K̶L̶M̶Ñ̶Õ̶P̶Q̶R̶S̶T̶Ũ̶V̶W̶X̶Ỹ̶Z̶ã̶b̶c̶d̶ẽ̶f̶g̶h̶ĩ̶j̶k̶l̶m̶ñ̶õ̶p̶q̶r̶s̶t̶ũ̶v̶w̶x̶ỹ̶z̶0̶1̶2̶3̶4̶5̶6̶7̶8̶9̶' },
    38: { name: 'Diaeresis', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ÄB̈C̈D̈ËF̈G̈ḦÏJ̈K̈L̈M̈N̈ÖP̈Q̈R̈S̈T̈ÜV̈ẄẌŸZ̈äb̈c̈d̈ëf̈g̈ḧïj̈k̈l̈m̈n̈öp̈q̈r̈s̈ẗüv̈ẅẍÿz̈0̈1̈2̈3̈4̈5̈6̈7̈8̈9̈' },
    39: { name: 'Macron', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ĀB̄C̄D̄ĒF̄Ḡ H̄ĪJ̄K̄L̄M̄N̄ŌP̄Q̄R̄S̄T̄ŪV̄W̄X̄ȲZ̄āb̄c̄d̄ēf̄ḡh̄īj̄k̄l̄m̄n̄ōp̄q̄r̄s̄t̄ūv̄w̄x̄ȳz̄0̄1̄2̄3̄4̄5̄6̄7̄8̄9̄' },
    40: { name: 'Caron', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ǍB̌ČĎĚF̌Ǧ ȞǏJ̌Ǩ LǏM̌ŇǑP̌Q̌Ř Š Ť ǓV̌ W̌X̌ Y̌ Žǎb̌čďěf̌ǧȟǐǰǩľň ǒp̌q̌ř š ť ǔ v̌ w̌x̌ y̌ž0̌1̌2̌3̌4̌5̌6̌7̌8̌9̌' },
    41: { name: 'Ogonek', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ĄB̨C̨D̨ĘF̨G̨H̨ĮJ̨K̨L̨M̨N̨ǪP̨Q̨R̨S̨T̨ŲV̨W̨X̨Y̨Z̨ąb̨c̨d̨ęf̨g̨h̨į j̨k̨l̨m̨n̨ǫp̨q̨r̨s̨t̨ųv̨w̨x̨y̨z̨0̨1̨2̨3̨4̨5̨6̨7̨8̨9̨' },
    42: { name: 'Cedilla', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A B Ç D E F G H I J K L M N O P Q R S Ţ U V W X Y Z a b ç d e f g h i j k l m n o p q r s ţ u v w x y z 0 1 2 3 4 5 6 7 8 9' },
    43: { name: 'Ring Above', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ÅB̊C̊D̊E̊F̊G̊H̊I̊J̊K̊L̊M̊N̊O̊P̊Q̊R̊S̊T̊ŮV̊W̊X̊Ỳz̊åb̊c̊d̊e̊f̊g̊h̊i̊j̊k̊l̊m̊n̊o̊p̊q̊r̊s̊t̊ův̊ẘx̊ẙz̊0̊1̊2̊3̊4̊5̊6̊7̊8̊9̊' },
    44: { name: 'Breve', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'ĂB̆C̆D̆Ĕ F̆ Ğ H̆ Ĭ J̆ K̆ L̆ M̆ N̆ Ŏ P̆ Q̆ R̆ S̆ T̆ Ŭ V̆ W̆ X̆ Y̆ Z̆ ă b̆ c̆ d̆ ĕ f̆ ğ h̆ ĭ j̆ k̆ l̆ m̆ n̆ ŏ p̆ q̆ r̆ s̆ t̆ ŭ v̆ w̆ x̆ y̆ z̆ 0̆ 1̆ 2̆ 3̆ 4̆ 5̆ 6̆ 7̆ 8̆ 9̆' },
    45: { name: 'Double Acute', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A B C D E F G H Ő J K L M N Ő P Q R S T Ű V W X Y Z a b c d e f g h ő j k l m n ő p q r s t ű v w x y z 0 1 2 3 4 5 6 7 8 9' },
    46: { name: 'Dot Below', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A Ḅ C̣ Ḍ Ẹ F̣ G̣ Ḥ Ị J̣ Ḳ Ḷ Ṃ Ṇ Ọ P̣ Q̣ Ṛ Ṣ Ṭ Ụ Ṿ Ẉ X̣ Ỵ Ẓ a ḅ c̣ ḍ ẹ f̣ g̣ ḥ ị j̣ ḳ ḷ ṃ ṇ ọ p̣ q̣ ṛ ṣ ṭ ụ ṿ ẉ x̣ ỵ ẓ 0̣ 1̣ 2̣ 3̣ 4̣ 5̣ 6̣ 7̣ 8̣ 9̣' },
    47: { name: 'Comma Below', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A B̦ C̦ D̦ E̦ F̦ G̦ H̦ I̦ J̦ K̦ Ļ M̦ N̦ O̦ P̦ Q̦ R̦ Ș Ţ U̦ V̦ W̦ X̦ Y̦ Z̦ a b̦ c̦ d̦ e̦ f̦ g̦ h̦ i̦ j̦ k̦ ļ m̦ n̦ o̦ p̦ q̦ r̦ ș ţ u̦ v̦ w̦ x̦ y̦ z̦ 0̦ 1̦ 2̦ 3̦ 4̦ 5̦ 6̦ 7̦ 8̦ 9̦' },
    48: { name: 'Stroke', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z a b c ð e f g h i j k l m n ø p q r s t u v w x y z 0 1 2 3 4 5 6 7 8 9' },
    49: { name: 'Hooks', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Ả B̉ C̉ D̉ Ẩ F̉ G̉ H̉ Ỉ J̉ K̉ L̉ M̉ N̉ Ỏ P̉ Q̉ R̉ S̉ T̉ Ủ V̉ W̉ X̉ Ỷ Z̉ ả b̉ c̉ d̉ ẩ f̉ g̉ h̉ ỉ j̉ k̉ l̉ m̉ n̉ ỏ p̉ q̉ r̉ s̉ t̉ ủ v̉ w̉ x̉ ỷ z̉ 0̉ 1̉ 2̉ 3̉ 4̉ 5̉ 6̉ 7̉ 8̉ 9̉' },
    50: { name: 'Horn', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z ư ƣ ư ư ư ƣ ư ư ư ư ư ư ư ư ư ư ư ư ư ư ư ư ư ư ư ư 0 1 2 3 4 5 6 7 8 9' },
    51: { name: 'Combining Grave', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'À B̀ C̀ D̀ È F̀ Ǧ H̀ Ì J̀ K̀ L̀ M̀ Ǹ Ò P̀ Q̀ R̀ S̀ T̀ Ù V̀ Ẁ X̀ Ỳ Z̀ à b̀ c̀ d̀ è f̀ ǧ h̀ ì j̀ k̀ l̀ m̀ ǹ ò p̀ q̀ r̀ s̀ t̀ ù v̀ ẁ x̀ ỳ z̀ 0̀ 1̀ 2̀ 3̀ 4̀ 5̀ 6̀ 7̀ 8̀ 9̀' },
    52: { name: 'Combining Acute', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Á B́ Ć D́ É F́ Ǵ H́ Í J́ Ḱ Ĺ Ḿ Ń Ó Ṕ Q́ Ŕ Ś T́ Ú V́ Ẃ X́ Ý Ź á b́ ć d́ é f́ ǵ h́ í j́ ḱ ĺ ḿ ń ó ṕ q́ ŕ ś t́ ú v́ ẃ x́ ý ź 0́ 1́ 2́ 3́ 4́ 5́ 6́ 7́ 8́ 9́' },
    53: { name: 'Combining Circumflex', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Â B̂ Ĉ D̂ Ê F̂ Ĝ Ĥ Î Ĵ K̂ L̂ M̂ N̂ Ô P̂ Q̂ R̂ Ŝ T̂ Û V̂ Ŵ X̂ Ŷ Ẑ â b̂ ĉ d̂ ê f̂ ĝ ĥ î ĵ k̂ l̂ m̂ n̂ ô p̂ q̂ r̂ ŝ t̂ û v̂ ŵ x̂ ŷ ẑ 0̂ 1̂ 2̂ 3̂ 4̂ 5̂ 6̂ 7̂ 8̂ 9̂' },
    54: { name: 'Combining Breve Above', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Ă B̆ C̆ D̆ Ĕ F̆ Ğ H̆ Ĭ J̆ K̆ L̆ M̆ N̆ Ŏ P̆ Q̆ R̆ S̆ T̆ Ŭ V̆ W̆ X̆ Y̆ Z̆ ă b̆ c̆ d̆ ĕ f̆ ğ h̆ ĭ j̆ k̆ l̆ m̆ n̆ ŏ p̆ q̆ r̆ s̆ t̆ ŭ v̆ w̆ x̆ y̆ z̆ 0̆ 1̆ 2̆ 3̆ 4̆ 5̆ 6̆ 7̆ 8̆ 9̆' },
    55: { name: 'Combining Double Acute', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A B́ Ć D́ E F́ Ǵ H́ I J́ Ḱ Ĺ Ḿ Ń O Ṕ Q́ Ŕ Ś T́ U V́ Ẃ X́ Y Ź a b́ ć d́ e f́ ǵ h́ i j́ ḱ ĺ ḿ ń o ṕ q́ ŕ ś t́ u v́ ẃ x́ y ź 0́ 1́ 2́ 3́ 4́ 5́ 6́ 7́ 8́ 9́' },
    56: { name: 'Combining Caron', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'Ǎ B̌ Č Ď Ě F̌ Ǧ Ȟ Ǐ J̌ Ǩ Ľ M̌ Ň Ǒ P̌ Q̌ Ř Š Ť Ǔ V̌ W̌ X̌ Y̌ Ž ǎ b̌ č ď ě f̌ ǧ ȟ ǐ ǰ ǩ ľ m̌ ň ǒ p̌ q̌ ř š ť ǔ v̌ w̌ x̌ y̌ ž 0̌ 1̌ 2̌ 3̌ 4̌ 5̌ 6̌ 7̌ 8̌ 9̌' },
    57: { name: 'Superscript Numbers', map: '0123456789', convert: '⁰¹²³⁴⁵⁶⁷⁸⁹' },
    58: { name: 'Subscript Numbers', map: '0123456789', convert: '₀₁₂₃₄₅₆₇₈₉' },
    59: { name: 'Fractions', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: 'A ⅐ ⅛ ⅑ ⅒ ⅓ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅜ ⅝ ⅞ ⅟ ⅞ ⅝ ⅜ ⅛ ⅟ ⅛ ⅚ ⅙ ⅘ ⅗ ⅖ ⅕ ⅓ ⅒ ⅑ ⅐ ½ ⅓ ⅔ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞ ⅐ ⅑ ⅒ ⅞ ½' },
    60: { name: 'Roman Numerals Upper', map: 'IVXLCDM', convert: 'ⅠⅤⅩⅬⅭⅮⅯ' },
    61: { name: 'Roman Numerals Lower', map: 'ivxlcdm', convert: 'ⅰⅴⅹⅼⅽⅾⅿ' },
    62: { name: 'Circled Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ' },
    63: { name: 'Circled Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ' },
    64: { name: 'Squared Negative Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '🆰🆱🆲🆳🆴🆵🆶🆷🆸🆹🆺🆻🆼🆽🆾🆿🇀🇁🇂🇃🇄🇅🇆🇇🇈🇉' },
    65: { name: 'Squared Negative Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉' },
    66: { name: 'Coptic Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'Ⲁ Ⲃ Ⲅ Ⲇ Ⲉ Ⲍ Ⲏ Ⲑ Ⲓ Ⲕ Ⲗ Ⲙ Ⲛ Ⲝ Ⲟ Ⲡ Ⲣ Ⲥ Ⲧ Ⲩ Ⲫ Ⲭ Ⲯ Ⲱ Ⲳ' },
    67: { name: 'Coptic Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'ⲁ ⲃ ⲅ ⲇ ⲉ ⲍ ⲏ ⲑ ⲓ ⲕ ⲗ ⲙ ⲛ ⲝ ⲟ ⲡ ⲣ ⲥ ⲧ ⲩ ⲫ ⲭ ⲯ ⲱ ⲳ' },
    68: { name: 'Attic Numbers', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '𐆄 𐆅 𐆆 𐆇 𐆈 𐆉 𐆊 𐆋 𐆌 𐆍 𐆎 𐆏 𐆐 𐆑 𐆒 𐆓 𐆔 𐆕 𐆖 𐆗 𐆘 𐆙 𐆚 𐆛 𐆜 𐆝' },
    69: { name: 'Morse Code', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '·−  ·−·−  −·−·  −··  ·  ··−·  −−·  ····  ··  ·−−−  −·−  ·−··  −−  −·  −−−  ·−−·  −−·−  ·−·  ···  −  ··−  ···−  ·−−  −··−  −−·−  −−··' },
    70: { name: 'Pigpen', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '🙰 🙱 🙲 🙳 🙴 🙵 🙶 🙷 🙸 🙹 🙺 🙻 🙼 🙽 🙾 🙿 🚀 🚁 🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉' },
    71: { name: 'Braille Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '⠠⠁ ⠠⠃ ⠠⠉ ⠠⠙ ⠠⠑ ⠠⠋ ⠠⠛ ⠠⠓ ⠠⠊ ⠠⠚ ⠠⠅ ⠠⠇ ⠠⠍ ⠠⠝ ⠠⠕ ⠠⠏ ⠠⠟ ⠠⠗ ⠠⠎ ⠠⠞ ⠠⠥ ⠠⠧ ⠠⠺ ⠠⠭ ⠠⠮ ⠠⠯' },
    72: { name: 'Braille Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: '⠁ ⠃ ⠉ ⠙ ⠑ ⠋ ⠛ ⠓ ⠊ ⠚ ⠅ ⠇ ⠍ ⠝ ⠕ ⠏ ⠟ ⠗ ⠎ ⠞ ⠥ ⠧ ⠺ ⠭ ⠮ ⠯' },
    73: { name: 'Armenian Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'Ա Բ Գ Դ Ե Զ Է Ը Թ Ժ Ի Լ Խ Ծ Կ Հ Ծ Մ Յ Ն Շ Ո Չ Պ Ջ Ռ' },
    74: { name: 'Armenian Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'ա բ գ դ ե զ է ը թ ժ ի լ խ ծ կ հ ծ մ յ ն շ ո չ պ ջ ռ' },
    75: { name: 'Georgian Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'Ａ Ｂ Ｃ Ｄ Ｅ Ｆ Ｇ Ｈ Ｉ Ｊ Ｋ Ｌ Ｍ Ｎ Ｏ Ｐ Ｑ Ｒ Ｓ Ｔ Ｕ Ｖ Ｗ Ｘ Ｙ Ｚ' },
    76: { name: 'Cyrillic Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'А Б В Г Д Е Ё Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ' },
    77: { name: 'Cyrillic Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ' },
    78: { name: 'Greek Upper', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω Α Β' },
    79: { name: 'Greek Lower', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω α β' },
    80: { name: 'Hebrew', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת א ב ג ד' },
    81: { name: 'Arabic', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن س' },
    82: { name: 'Japanese Hiragana', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の' },
    83: { name: 'Japanese Katakana', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ア イ ウ エ オ カ キ ク ケ コ サ シ ス セ ソ タ チ ツ テ ト ナ ニ ヌ ネ ノ' },
    84: { name: 'Chinese Simplified', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '啊 吧 呃 呕 呔 否 发 呸 哈 嘻 咔 啦 嘛 呢 哦 呵 欠 呒 呃 吞 乌 呣 喔 吓 呀 咂' },
    85: { name: 'Tibetan', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ཀ ཁ ག གྷ ང ཅ ཆ ཇ ཉ ཏ ཐ ད དྷ ན པ ཕ བ བྷ མ ཙ ཚ ཛ ཝ ཞ ཟ ཡ ཡ' },
    86: { name: 'Thai', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ก ข ค ค ง จ ฉ ช ย ด ต ถ ท ธ น บ ป พ ฟ ม ย ร ล ว ศ ษ ส' },
    87: { name: 'Devanagari', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'अ आ इ ई उ ऊ ऋ ए ऐ ओ औ क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ' },
    88: { name: 'Bengali', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'অ আ ই ঈ উ ঊ ঋ এ ঐ ও ঔ ক খ গ ঘ ঙ চ ছ জ ঝ ঞ ট ঠ ড ঢ' },
    89: { name: 'Kannada', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ಅ ಆ ಇ ಈ ಉ ಊ ಋ ಎ ಏ ಐ ಒ ಓ ಔ ಕ ಖ ಗ ಘ ಙ ಚ ಛ ಜ ಝ ಞ ಟ' },
    90: { name: 'Malayalam', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'അ ആ ഇ ഈ ഉ ഊ ഋ എ ഏ ഐ ഒ ഓ ഔ ക ഖ ഗ ഘ ങ ച ഛ ജ ഝ ഞ ട' },
    91: { name: 'Sinhala', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'අ ආ ඇ ඈ ඉ ඊ උ එ ඒ ඓ ඔ ඕ ඖ ක ඛ ག ඝ ང �� ඡ ජ ඣ ඤ ඥ ඦ' },
    92: { name: 'Khmer', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ' },
    93: { name: 'Lao', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'ກ ຂ ຄ ງ ຈ ສ ຊ ຍ ດ ຕ ຖ ທ ນ ບ ປ ຜ ພ ມ ຢ ຣ ລ ວ ສ ຫ ອ ຮ' },
    94: { name: 'Myanmar', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: 'က ခ ག ঘ ङ စ ဆ ဇ ఞ ट ठ ড ඩ ण ත ේ ේ ෙ ෙ ්' },
    95: { name: 'Emoji Variant 1', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '🅰 🅱 🅲 🅳 🅴 🅵 🅶 🅷 🅸 🅹 🅺 🅻 🅼 🅽 🅾 🅿 🆀 🆁 🆂 🆃 🆄 🆅 🆆 🆇 🆈 🆉' },
    96: { name: 'Emoji Variant 2', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', convert: '🄰 🄱 🄲 🄳 🄴 🄵 🄶 🄷 🄸 🄹 🄺 🄻 🄼 🄽 🄾 🄿 🅀 🅁 🅂 🅃 🅄 🅅 🅆 🅇 🅈 🅉' },
    97: { name: 'Flipped', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'ɐ q ɔ p ǝ ɟ ƃ ɥ ᴉ ɾ ʞ l ɯ u o d b ɹ s ʇ n ʌ ʍ x ʎ z' },
    98: { name: 'Mirror', map: 'abcdefghijklmnopqrstuvwxyz', convert: 'ɒ d ɔ p ə ɟ ⅁ ɥ ᴉ ɾ ʞ l ɯ u o b d ɹ s ⊥ n ʌ ʍ x ʎ z' },
    99: { name: 'Fancy Numbers', map: '0123456789', convert: '⓪①②③④⑤⑥⑦⑧⑨' },
    100: { name: 'Fancy Text Mix', map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', convert: '𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹𝑒𝒻𝒼𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝓄𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡' },
};

function convertText(text, fontNumber) {
    const font = FONTS[fontNumber];
    if (!font) return null;

    let result = '';
    for (const char of text) {
        const index = font.map.indexOf(char);
        if (index !== -1) {
            result += font.convert[index];
        } else {
            result += char;
        }
    }
    return result;
}

module.exports = {
    name: 'fontmaker',
    aliases: ['font', 'fonts', 'textfont'],
    desc: 'Convert text to 100 different font styles',
    category: 'utility',
    usage: '.fontmaker <font_number> <text>',

    execute: async (context) => {
        const { sock, msg: m, args, reply } = context;
        if (args.length < 2) {
            // Show available fonts
            let fontList = `*━━ FONTMAKER - 100 FONTS ━━*\n\n`;
            let count = 1;
            for (const [num, font] of Object.entries(FONTS)) {
                if (count % 5 === 0) {
                    fontList += `${num}. ${font.name}\n`;
                } else {
                    fontList += `${num}. ${font.name} | `;
                }
                count++;
            }
            fontList += `\n*Usage:* .fontmaker <number> <text>\n`;
            fontList += `*Example:* .fontmaker 1 hello world`;
            return reply(fontList);
        }

        const fontNumber = parseInt(args[0]);
        const text = args.slice(1).join(' ');

        if (isNaN(fontNumber) || fontNumber < 1 || fontNumber > 100) {
            return reply(`❌ Font number must be between 1 and 100\n\nUse .fontmaker to see all fonts`);
        }

        if (!text || text.trim().length === 0) {
            return reply('❌ Please provide text to convert');
        }

        const font = FONTS[fontNumber];
        const result = convertText(text, fontNumber);

        if (!result) {
            return reply(`❌ Font ${fontNumber} not found`);
        }

        return reply(`*${font.name}*\n\n${result}`);
    }
};
