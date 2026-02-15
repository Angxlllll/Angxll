import fs from "fs"
import path from "path"
import axios from "axios"

const stickerPath = path.join(process.cwd(), "media", "grupo.webp")

async function ensureSticker() {
  if (!fs.existsSync(stickerPath)) {
    let { data } = await axios.get("https://cdn.russellxz.click/9b99dd72.webp", {
      responseType: "arraybuffer"
    })
    fs.mkdirSync(path.dirname(stickerPath), { recursive: true })
    fs.writeFileSync(stickerPath, Buffer.from(data))
  }
}

let handler = async (m, { conn }) => {
  await ensureSticker()

  let text = m.text.toLowerCase()

  let abrir = /(abrir|open)/.test(text)
  let cerrar = /(cerrar|close)/.test(text)

  if (!abrir && !cerrar) return

  await conn.groupSettingUpdate(
    m.chat,
    abrir ? "not_announcement" : "announcement"
  )

  await conn.sendMessage(
    m.chat,
    { sticker: fs.readFileSync(stickerPath) },
    { quoted: m }
  )

  await conn.sendMessage(
    m.chat,
    { react: { text: "✅", key: m.key } }
  )
}

handler.help = ["𝖦𝗋𝗎𝗉𝗈 𝖠𝖻𝗋𝗂𝗋", "𝖦𝗋𝗎𝗉𝗈 𝖢𝖾𝗋𝗋𝖺𝗋"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.command = ['grupo cerrar', 'grupo abrir', 'abrir', 'cerrar']
handler.group = true
handler.admin = true
export default handler