import axios from 'axios'
import sharp from 'sharp'

const GROUP_TTL = 60_000
const MAX_GROUP_CACHE = 500

const groupCache = new Map()
const groupLocks = new Map()

const getBuffer = async (url) => {
  try {
    const { data } = await axios.get(url, { responseType: 'arraybuffer' })
    return data
  } catch {
    return null
  }
}

async function updateGroupCache(conn, chatId) {
  const now = Date.now()
  const cached = groupCache.get(chatId)

  if (cached && now - cached.t < GROUP_TTL) {
    return cached.v
  }

  if (groupLocks.has(chatId)) {
    return groupLocks.get(chatId)
  }

  const promise = (async () => {
    const meta = await conn.groupMetadata(chatId).catch(() => null)
    const name = meta?.subject || global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"

    let thumb = null
    const ppUrl = await conn.profilePictureUrl(chatId, 'image').catch(() => null)

    if (ppUrl) {
      const original = await getBuffer(ppUrl)
      if (original) {
        thumb = await sharp(original)
          .resize(200, 200, { fit: 'cover' })
          .jpeg({ quality: 60 })
          .toBuffer()
      }
    }

    const value = { name, thumb }
    groupCache.set(chatId, { v: value, t: Date.now() })

    if (groupCache.size > MAX_GROUP_CACHE) {
      const oldest = groupCache.keys().next().value
      if (oldest) groupCache.delete(oldest)
    }

    groupLocks.delete(chatId)
    return value
  })()

  groupLocks.set(chatId, promise)
  return promise
}

global.getFakeQuote = async (m, conn) => {
  const FAKE_SENDER = '867051314767696@bot'
  const chatId = m.chat

  let title = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
  let thumb = null

  if (m.isGroup) {
    const data = await updateGroupCache(conn, chatId)
    title = data.name
    thumb = data.thumb
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
          productImage: thumb
            ? {
                mimetype: "image/jpeg",
                jpegThumbnail: thumb
              }
            : undefined,
          title,
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