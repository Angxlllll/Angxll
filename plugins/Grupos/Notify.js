import {
  getContentType,
  downloadContentFromMessage
} from '@whiskeysockets/baileys'

function unwrap(msg) {
  let m = msg
  while (m) {
    const next =
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message ||
      m.ephemeralMessage?.message
    if (!next) break
    m = next
  }
  return m
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}

const handler = async (m, { conn, args, getGroupMeta }) => {
  if (!getGroupMeta) return

  conn.sendMessage(m.chat, {
    react: { text: '🗣️', key: m.key }
  }).catch(() => {})

  const text = args.join(' ')
  const meta = await getGroupMeta()
  const mentionedJid = meta.participants.map(p => p.id || p.jid)

  const fquote = await global.getFakeQuote(m, conn)

  let root = unwrap(m.message)
  let source = null
  let sourceType = null

  if (root) {
    sourceType = getContentType(root)
    if (
      sourceType &&
      !['conversation', 'extendedTextMessage'].includes(sourceType)
    ) {
      source = root[sourceType]
    }
  }

  if (!source && m.quoted) {
    const q = unwrap(m.quoted.message)
    if (q) {
      sourceType = getContentType(q)

      if (
        sourceType &&
        !['conversation', 'extendedTextMessage'].includes(sourceType)
      ) {
        source = q[sourceType]
      } else {
        const qtext =
          q.conversation ||
          q.extendedTextMessage?.text

        if (qtext) {
          return conn.sendMessage(
            m.chat,
            {
              text: qtext,
              contextInfo: { mentionedJid }
            },
            { quoted: fquote }
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
        contextInfo: { mentionedJid }
      },
      { quoted: fquote }
    )
  }

  if (!source) {
    return m.reply(
      '❌ Uso:\n• .n texto\n• Responde a un mensaje con .n'
    )
  }

  const mediaStream = await downloadContentFromMessage(
    source,
    sourceType.replace('Message', '')
  )

  const buffer = await streamToBuffer(mediaStream)

  let payload

  if (sourceType === 'audioMessage') {
    payload = {
      audio: buffer,
      mimetype: source.mimetype || 'audio/mpeg',
      ptt: false
    }
  } else {
    payload = {
      [sourceType.replace('Message', '')]: buffer,
      caption: text || undefined
    }
  }

  await conn.sendMessage(
    m.chat,
    {
      ...payload,
      contextInfo: { mentionedJid }
    },
    { quoted: fquote }
  )
}

handler.command = ['n', 'tag', 'notify']
handler.group = true
handler.admin = true
handler.needsMeta = true
handler.help = ['Notify']
handler.tags = ['Grupos']

export default handler