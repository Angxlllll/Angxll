import fs from "fs"
import path from "path"
import axios from "axios"

const stickerPath = path.join(process.cwd(), "media", "grupo.webp")

async function ensureSticker() {
  if (fs.existsSync(stickerPath)) return

  const { data } = await axios.get(
    "https://cdn.russellxz.click/9b99dd72.webp",
    { responseType: "arraybuffer" }
  )

  fs.mkdirSync(path.dirname(stickerPath), { recursive: true })
  fs.writeFileSync(stickerPath, Buffer.from(data))
}

const handler = async (m, { conn, command }) => {
  const cmd = command.toLowerCase()

  const abrir =
    cmd === "abrir" ||
    cmd === "grupo abrir"

  const cerrar =
    cmd === "cerrar" ||
    cmd === "grupo cerrar"

  if (!abrir && !cerrar) return

  await conn.groupSettingUpdate(
    m.chat,
    abrir ? "not_announcement" : "announcement"
  )

  await ensureSticker()

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

handler.help = ["grupo abrir", "grupo cerrar"]
handler.tags = ["grupos"]
handler.command = ["grupo abrir", "grupo cerrar", "abrir", "cerrar"]
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler