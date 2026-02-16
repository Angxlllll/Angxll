"use strict"

import axios from "axios"

const makeFkontak = (img, title, botname) => ({
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net"
  },
  message: {
    productMessage: {
      product: {
        productImage: { jpegThumbnail: img },
        title: title,
        description: botname,
        currencyCode: "USD",
        priceAmount1000: "10000",
        retailerId: "ANGEL-BOT"
      },
      businessOwnerJid: "0@s.whatsapp.net"
    }
  }
})

let handler = async (m, { conn }) => {

  const url = "https://iili.io/FKVDVAN.jpg"
  const { data } = await axios.get(url, { responseType: "arraybuffer" })
  const buffer = Buffer.from(data)

  const fkontak = makeFkontak(buffer, "Angel Bot", "Angel Bot")

  await conn.sendMessage(m.chat, {
    text: "Hola 👋\nEste es Angel Bot en acción 🚀",
    contextInfo: {
      quotedMessage: fkontak.message
    }
  }, { quoted: m })

}

handler.help = ["hola"]
handler.tags = ["main"]
handler.command = ["hola"]

export default handler