import axios from "axios"

export async function beforeAll() {
  try {
    const nombreBot = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
    const bannerFinal = "https://files.catbox.moe/9yuy4n.jpg"

    // 🔥 Convertimos la imagen a buffer aquí mismo
    const response = await axios.get(bannerFinal, {
      responseType: 'arraybuffer'
    })
    const bannerBuffer = response.data

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
          title: nombreBot,
          body: global.author,
          thumbnail: bannerBuffer, // 🔥 ya es buffer
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