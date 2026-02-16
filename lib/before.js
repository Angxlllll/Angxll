import axios from 'axios'
import sharp from 'sharp'

global.rcanal = async (conn, m) => {
  try {
    let nombreFinal = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
    let thumbnailBuffer = null

    if (m.chat.endsWith('@g.us')) {
      const metadata = await conn.groupMetadata(m.chat)
      nombreFinal = metadata.subject

      const ppGrupo = await conn.profilePictureUrl(m.chat, 'image')
      const response = await axios.get(ppGrupo, { responseType: 'arraybuffer' })
      thumbnailBuffer = response.data
    } else {
      const ppBot = await conn.profilePictureUrl(conn.user.id, 'image')
      const response = await axios.get(ppBot, { responseType: 'arraybuffer' })
      thumbnailBuffer = response.data
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

  } catch {
    return {}
  }
}