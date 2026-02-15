import axios from "axios"

export async function beforeAll() {
  try {
    const nombreBot = global.namebot || "𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍"
    const bannerFinal = "https://files.catbox.moe/js07dr.jpg"

    const img = await axios.get(bannerFinal, {
      responseType: "arraybuffer"
    })

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
          thumbnail: Buffer.from(img.data),
          sourceUrl: "https://whatsapp.com",
          mediaType: 1,
          renderLargerThumbnail: true,
          showAdAttribution: false
        }
      }
    }
  } catch (e) {
    console.log("Error al generar rcanal:", e)
  }
}