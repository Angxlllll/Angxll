import Crypto from "crypto"
import ffmpeg from "fluent-ffmpeg"
import webp from "node-webpmux"
import { Readable } from "stream"

function unwrapMessage(m) {
  let n = m
  while (true) {
    const next =
      n?.viewOnceMessage?.message ||
      n?.viewOnceMessageV2?.message ||
      n?.viewOnceMessageV2Extension?.message ||
      n?.ephemeralMessage?.message
    if (!next) break
    n = next
  }
  return n
}

function ensureWA(wa, conn) {
  return (
    wa?.downloadContentFromMessage ||
    conn?.wa?.downloadContentFromMessage ||
    global.wa?.downloadContentFromMessage
  )
}

const handler = async (msg, { conn, wa }) => {
  const chatId = msg.key.remoteJid

  const ctx = msg.message?.extendedTextMessage?.contextInfo
  const quoted = ctx?.quotedMessage
    ? unwrapMessage(ctx.quotedMessage)
    : null

  const target = quoted || msg.message

  const mediaType = target?.imageMessage
    ? "image"
    : target?.videoMessage
    ? "video"
    : null

  if (!mediaType) {
    return conn.sendMessage(
      chatId,
      { text: "⚠️ *Responde a una imagen o video para crear un sticker*" },
      { quoted: msg }
    )
  }

  await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })

  const download = ensureWA(wa, conn)
  if (!download) return

  try {
    const stream = await download(
      target[`${mediaType}Message`],
      mediaType
    )

    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const metadata = {
      packname: msg.pushName || "Usuario",
      author: ""
    }

    const webpBuffer =
      mediaType === "image"
        ? await imageToWebp(buffer)
        : await videoToWebp(buffer)

    const stickerBuffer = await addExif(webpBuffer, metadata)

    await conn.sendMessage(
      chatId,
      { sticker: stickerBuffer },
      { quoted: msg }
    )

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })
  } catch {
    await conn.sendMessage(
      chatId,
      { text: "❌ Hubo un error al crear el sticker." },
      { quoted: msg }
    )
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } })
  }
}

handler.help = ["s"]
handler.tags = ["stickers"]
handler.command = ['s', 'sticker']
export default handler

async function imageToWebp(media) {
  return convertToWebp(media, false)
}

async function videoToWebp(media) {
  return convertToWebp(media, true)
}

async function convertToWebp(buffer, isVideo) {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(buffer)
    const chunks = []

    const command = ffmpeg(inputStream)
      .inputFormat(isVideo ? "mp4" : "jpg")
      .addOutputOptions([
        "-vcodec", "libwebp",
        "-vf",
        "scale='min(320,iw)':min(320,ih):force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0"
      ])
      .format("webp")
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)))

    if (isVideo) {
      command.addOutputOptions([
        "-loop", "0",
        "-t", "00:00:05",
        "-an"
      ])
    }

    const stream = command.pipe()
    stream.on("data", chunk => chunks.push(chunk))
  })
}

async function addExif(webpBuffer, metadata) {
  const json = {
    "sticker-pack-id": Crypto.randomBytes(8).toString("hex"),
    "sticker-pack-name": metadata.packname,
    "sticker-pack-publisher": metadata.author,
    emojis: [""]
  }

  const exifAttr = Buffer.from([
    0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,
    0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,
    0x00,0x00,0x16,0x00,0x00,0x00
  ])

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)

  const img = new webp.Image()
  await img.load(webpBuffer)
  img.exif = exif

  return await img.save(null)
}