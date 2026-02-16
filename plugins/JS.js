"use strict"

import fs from "fs"

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

  const img = fs.readFileSync("https://iili.io/FKVDVAN.jpg") // pon aquí tu imagen
  const fkontak = makeFkontak(img, "Angel Bot", "Angel Bot")

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