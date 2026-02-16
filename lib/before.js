import axios from 'axios'
import sharp from 'sharp'

const getBuffer = async (url) => {
  try {
    const { data } = await axios.get(url, { responseType: 'arraybuffer' })
    return data
  } catch {
    return null
  }
}

global.rcanal = async (conn, m) => {
  try {
    const isGroup = m.chat.endsWith('@g.us')

    let nombreFinal = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
    let thumbnailBuffer = null

    if (isGroup) {
      const metadata = await conn.groupMetadata(m.chat)
      nombreFinal = metadata?.subject || nombreFinal
    }

    const jid = isGroup ? m.chat : conn.user.id
    const pp = await conn.profilePictureUrl(jid, 'image').catch(() => null)

    if (pp) thumbnailBuffer = await getBuffer(pp)

    return {
      contextInfo: {
        isForwarded: true,
        forwardingScore: 1,
        externalAdReply: {
          title: nombreFinal,
          body: global.author,
          thumbnail: thumbnailBuffer,
          mediaType: 1,
          renderLargerThumbnail: false,
          showAdAttribution: false,
          containsAutoReply: true
        }
      }
    }

  } catch {
    return {}
  }
}

global.getFakeQuote = async (m, conn) => {
  const FAKE_SENDER = '867051314767696@bot'
  const isGroup = m.isGroup

  let groupName = 'Chat'
  let thumb = null

  if (isGroup) {
    const meta = await conn.groupMetadata(m.chat).catch(() => null)
    groupName = meta?.subject || groupName
  }

  const pp = await conn.profilePictureUrl(m.chat, 'image').catch(() => null)

  if (pp) {
    try {
      const original = await getBuffer(pp)
      if (original) {
        thumb = await sharp(original)
          .resize(200, 200, { fit: 'cover' })
          .jpeg({ quality: 60 })
          .toBuffer()
      }
    } catch {}
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