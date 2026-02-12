const countryFlags = Object.freeze({
  '1': '🇺🇸','7': '🇷🇺','20': '🇪🇬','27': '🇿🇦','30': '🇬🇷',
  '31': '🇳🇱','32': '🇧🇪','33': '🇫🇷','34': '🇪🇸','36': '🇭🇺',
  '39': '🇮🇹','40': '🇷🇴','41': '🇨🇭','43': '🇦🇹','44': '🇬🇧',
  '45': '🇩🇰','46': '🇸🇪','47': '🇳🇴','48': '🇵🇱','49': '🇩🇪',
  '51': '🇵🇪','52': '🇲🇽','53': '🇨🇺','54': '🇦🇷','55': '🇧🇷',
  '56': '🇨🇱','57': '🇨🇴','58': '🇻🇪','60': '🇲🇾','61': '🇦🇺',
  '62': '🇮🇩','63': '🇵🇭','64': '🇳🇿','65': '🇸🇬','66': '🇹🇭',
  '81': '🇯🇵','82': '🇰🇷','84': '🇻🇳','86': '🇨🇳',
  '90': '🇹🇷','91': '🇮🇳','92': '🇵🇰','93': '🇦🇫',
  '94': '🇱🇰','95': '🇲🇲','98': '🇮🇷',
  '211': '🇸🇸','212': '🇲🇦','213': '🇩🇿','216': '🇹🇳','218': '🇱🇾',
  '220': '🇬🇲','221': '🇸🇳','222': '🇲🇷','223': '🇲🇱',
  '224': '🇬🇳','225': '🇨🇮','226': '🇧🇫','227': '🇳🇪',
  '228': '🇹🇬','229': '🇧🇯','230': '🇲🇺','231': '🇱🇷',
  '232': '🇸🇱','233': '🇬🇭','234': '🇳🇬','235': '🇹🇩',
  '236': '🇨🇫','237': '🇨🇲','238': '🇨🇻','239': '🇸🇹',
  '240': '🇬🇶','241': '🇬🇦','242': '🇨🇬','243': '🇨🇩',
  '244': '🇦🇴','245': '🇬🇼','248': '🇸🇨','249': '🇸🇩',
  '250': '🇷🇼','251': '🇪🇹','252': '🇸🇴','253': '🇩🇯',
  '254': '🇰🇪','255': '🇹🇿','256': '🇺🇬','257': '🇧🇮',
  '258': '🇲🇿','260': '🇿🇲','261': '🇲🇬','263': '🇿🇼',
  '264': '🇳🇦','265': '🇲🇼','266': '🇱🇸','267': '🇧🇼',
  '268': '🇸🇿','269': '🇰🇲','290': '🇸🇭','291': '🇪🇷',
  '297': '🇦🇼','298': '🇫🇴','299': '🇬🇱',
  '350': '🇬🇮','351': '🇵🇹','352': '🇱🇺','353': '🇮🇪',
  '354': '🇮🇸','355': '🇦🇱','356': '🇲🇹','357': '🇨🇾',
  '358': '🇫🇮','359': '🇧🇬','370': '🇱🇹','371': '🇱🇻',
  '372': '🇪🇪','373': '🇲🇩','374': '🇦🇲','375': '🇧🇾',
  '376': '🇦🇩','377': '🇲🇨','378': '🇸🇲','380': '🇺🇦',
  '381': '🇷🇸','382': '🇲🇪','385': '🇭🇷','386': '🇸🇮',
  '387': '🇧🇦','389': '🇲🇰','420': '🇨🇿','421': '🇸🇰',
  '423': '🇱🇮','500': '🇫🇰','501': '🇧🇿','502': '🇬🇹',
  '503': '🇸🇻','504': '🇭🇳','505': '🇳🇮','506': '🇨🇷',
  '507': '🇵🇦','509': '🇭🇹','591': '🇧🇴','593': '🇪🇨',
  '595': '🇵🇾','598': '🇺🇾','670': '🇹🇱','672': '🇳🇫',
  '673': '🇧🇳','675': '🇵🇬','676': '🇹🇴','677': '🇸🇧',
  '678': '🇻🇺','679': '🇫🇯','852': '🇭🇰','853': '🇲🇴',
  '880': '🇧🇩','886': '🇹🇼','960': '🇲🇻','961': '🇱🇧',
  '962': '🇯🇴','964': '🇮🇶','965': '🇰🇼','966': '🇸🇦',
  '971': '🇦🇪','972': '🇮🇱','973': '🇧🇭','974': '🇶🇦',
  '976': '🇲🇳','977': '🇳🇵'
})

const prefixes = Object.keys(countryFlags).sort((a, b) => b.length - a.length)
const flagCache = new Map()

const getFlagFromNumber = num => {
  const cached = flagCache.get(num)
  if (cached) return cached

  let flag = '🏳️'
  for (let i = 0; i < prefixes.length; i++) {
    const p = prefixes[i]
    if (num.startsWith(p)) {
      flag = countryFlags[p]
      break
    }
  }

  flagCache.set(num, flag)
  return flag
}

const handler = async (m, { conn, getGroupMeta }) => {
  if (!getGroupMeta) return

  await conn.sendMessage(m.chat, {
    react: { text: '🗣️', key: m.key }
  })

  const meta = await getGroupMeta()
  const participants = meta.participants
  if (!participants?.length) return

  const lines = []
  const mentions = []

  for (let i = 0; i < participants.length; i++) {
    const jid = participants[i].id
    if (!jid || !jid.endsWith('@s.whatsapp.net')) continue

    const atIndex = jid.indexOf('@')
    const num = jid.slice(0, atIndex)

    const flag = getFlagFromNumber(num)

    lines.push(`┊» ${flag} @${num}`)
    mentions.push(jid)
  }

  if (!mentions.length) return

  const text =
`!  MENCION GENERAL  !
PARA ${mentions.length} MIEMBROS 🗣️

${lines.join('\n')}`

  await conn.sendMessage(
    m.chat,
    { text, mentions },
    { quoted: m }
  )
}

handler.help = ['todos']
handler.tags = ['grupos']
handler.command = ['todos']
handler.group = true
handler.admin = true

export default handler