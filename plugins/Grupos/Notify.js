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

const handler = async (m, { conn, args, getGroupMeta }) => {
  if (!getGroupMeta) return

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

  const meta = await getGroupMeta()
  const mentionedJid = meta.participants.map(p => p.id)

  if (!source && m.quoted) {
    const q = unwrap(m.quoted.message)
    if (q) {
      sourceType = getContentType(q)
      if (sourceType && !['conversation', 'extendedTextMessage'].includes(sourceType)) {
        source = q[sourceType]
      } else {
        const qtext = q.conversation || q.extendedTextMessage?.text
        if (qtext) {
          return sendStyledMessage(conn, m, {
            text: qtext,
            mentionedJid
          })
        }
      }
    }
  }

  if (!source && text) {
    return sendStyledMessage(conn, m, {
      text,
      mentionedJid
    })
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

  return sendStyledMessage(conn, m, {
    ...payload,
    mentionedJid
  })
}

/* ============================= */
/*  BLOQUE ESTILO META AI       */
/* ============================= */

async function sendStyledMessage(conn, m, payload) {
  const groupMeta = await conn.groupMetadata(m.chat)
  const groupName = groupMeta.subject

  let thumb = null
  try {
    const pp = await conn.profilePictureUrl(m.chat, 'image')
    const res = await fetch(pp)
    thumb = Buffer.from(await res.arrayBuffer())
  } catch {
    thumb = null
  }

  return conn.sendMessage(
    m.chat,
    {
      ...payload,
      contextInfo: {
        mentionedJid: payload.mentionedJid || [],
        forwardingScore: 1,
        isForwarded: true,
        externalAdReply: {
          title: groupName,
          body: "Meta AI · Estado",
          thumbnail: thumb,
          mediaType: 1,
          renderLargerThumbnail: false,
          showAdAttribution: false
        }
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