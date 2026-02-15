import axios from 'axios'

export async function beforeAll(conn, m) {
  try {
    let nombreFinal = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
    let thumbnailBuffer = null

    if (m && m.chat && m.chat.endsWith('@g.us')) {
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

    const canales = [global.idcanal, global.idcanal2].filter(Boolean)
    const newsletterJidRandom = canales.length
      ? canales[Math.floor(Math.random() * canales.length)]
      : null

    global.rcanal = {
      contextInfo: {
        isForwarded: true,
        forwardingScore: 1,
        ...(newsletterJidRandom && {
          forwardedNewsletterMessageInfo: {
            newsletterJid: newsletterJidRandom,
            serverMessageId: 100,
            newsletterName: global.namecanal
          }
        }),
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

  } catch (e) {
    console.log("Error en beforeAll:", e)
  }
}