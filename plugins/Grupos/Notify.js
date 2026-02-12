import {
  getContentType,
  downloadContentFromMessage
} from '@whiskeysockets/baileys'

function unwrap(m) {
  let n = m
  while (n) {
    const next =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message
    if (!next) break
    n = next
  }
  return n
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0)
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}

const getMentions = (conn, participants = []) =>
  participants
    .map(p => conn.decodeJid(p.jid || p.id))
    .filter(Boolean)

const handler = async (m, { conn, args, participants }) => {
  const text = args.length ? args.join(' ') : ''
  const root = unwrap(m.message)

  let source = null
  let sourceType = null

  if (root) {
    sourceType = getContentType(root)
    if (sourceType && !['conversation', 'extendedTextMessage'].includes(sourceType)) {
      source = root[sourceType]
    }
  }

  if (!source && m.quoted) {
    const q = unwrap(m.quoted.message)
    if (q) {
      sourceType = getContentType(q)
      if (sourceType && !['conversation', 'extendedTextMessage'].includes(sourceType)) {
        source = q[sourceType]
      } else {
        const qtext = q.conversation || q.extendedTextMessage?.text
        if (qtext) {
          return conn.sendMessage(
            m.chat,
            {
              text: qtext,
              contextInfo: {
                mentionedJid: getMentions(conn, participants),
                forwardingScore: 1,
                isForwarded: true
              }
            },
            { quoted: m }
          )
        }
      }
    }
  }

  if (!source && text) {
    return conn.sendMessage(
      m.chat,
      {
        text,
        contextInfo: {
          mentionedJid: getMentions(conn, participants),
          forwardingScore: 1,
          isForwarded: true
        }
      },
      { quoted: m }
    )
  }

  if (!source) {
    return m.reply(
      '❌ *Uso incorrecto*\n\n• `.n texto`\n• Responde a un mensaje con `.n`'
    )
  }

  const media = await streamToBuffer(
    await downloadContentFromMessage(
      source,
      sourceType.replace('Message', '')
    )
  )

  let payload

  if (sourceType === 'audioMessage') {
    payload = {
      audio: media,
      mimetype: source.mimetype || 'audio/mpeg',
      ptt: false
    }
  } else {
    payload = {
      [sourceType.replace('Message', '')]: media,
      caption: text || undefined
    }
  }

  await conn.sendMessage(
    m.chat,
    {
      ...payload,
      contextInfo: {
        mentionedJid: getMentions(conn, participants),
        forwardingScore: 1,
        isForwarded: true
      }
    },
    { quoted: m }
  )
}

handler.command = ['n', 'tag', 'notify']
handler.group = true
handler.admin = true
handler.help = ['Notify']
handler.tags = ['Grupos']

export default handler