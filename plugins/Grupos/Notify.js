import {
  getContentType,
  downloadContentFromMessage
} from '@whiskeysockets/baileys'

import sharp from 'sharp'
import fetch from 'node-fetch'

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

async function getFakeQuote(m, conn) {
  const FAKE_SENDER = '867051314767696@bot'

  let groupName = 'Chat'
  let thumb = null

  try {
    if (m.isGroup) {
      const meta = await conn.groupMetadata(m.chat)
      groupName = meta.subject || groupName
    }
  } catch {}

  try {
    const pp = await conn.profilePictureUrl(m.chat, 'image')
    const res = await fetch(pp)
    const original = Buffer.from(await res.arrayBuffer())

    thumb = await sharp(original)
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 60 })
      .toBuffer()
  } catch {
    thumb = null
  }

  return {
    key: {
      remoteJid: m.chat,
      fromMe: false,
      id: 'FAKE_ID',
      participant: FAKE_SENDER
    },
    message: {
      productMessage: {
        product: {
          productImage: {
            mimetype: "image/jpeg",
            jpegThumbnail: thumb
          },
          title: groupName,
          description: groupName,
          priceAmount1000: 1,
          retailerId: "notify",
          productImageCount: 1
        },
        businessOwnerJid: FAKE_SENDER
      }
    },
    participant: FAKE_SENDER
  }
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
  const fquote = await getFakeQuote(m, conn)

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
      '❌ Uso incorrecto\n\n• .n texto\n• Responde a un mensaje con .n'
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
      contextInfo: { mentionedJid }
    },
    { quoted: fquote }
  )
}

handler.command = ['n', 'tag', 'notify']
handler.group = true
handler.admin = true
handler.help = ['Notify']
handler.tags = ['Grupos']

export default handler