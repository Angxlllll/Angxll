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

global.groupCache = {}

const updateGroupCache = async (conn, chatId) => {
  let cache = global.groupCache[chatId] || {}
  const meta = await conn.groupMetadata(chatId).catch(() => null)
  const name = meta?.subject || global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
  const ppUrl = await conn.profilePictureUrl(chatId, 'image').catch(() => null)

  let thumb = cache.thumb
  if (!thumb || cache.ppUrl !== ppUrl) {
    if (ppUrl) {
      const original = await getBuffer(ppUrl)
      if (original) {
        thumb = await sharp(original)
          .resize(200, 200, { fit: 'cover' })
          .jpeg({ quality: 60 })
          .toBuffer()
      }
    }
  }

  global.groupCache[chatId] = { name, thumb, ppUrl }
  return global.groupCache[chatId]
}

global.rcanal = async (conn, m) => {
  const isGroup = m.chat.endsWith('@g.us')
  const chatId = m.chat

  let nombreFinal = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
  let thumbnailBuffer = null

  if (isGroup) {
    const cache = await updateGroupCache(conn, chatId)
    nombreFinal = cache.name
    thumbnailBuffer = cache.thumb
  } else {
    const pp = await conn.profilePictureUrl(conn.user.id, 'image').catch(() => null)
    if (pp) thumbnailBuffer = await getBuffer(pp)
  }

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
}

global.getFakeQuote = async (m, conn) => {
  const FAKE_SENDER = '867051314767696@bot'
  const chatId = m.chat
  let groupName = 'Chat'
  let thumb = null

  if (m.isGroup) {
    const cache = await updateGroupCache(conn, chatId)
    groupName = cache.name
    thumb = cache.thumb
  }

  return {
    key: {
      remoteJid: chatId,
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