import Crypto from "crypto"
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "@ffmpeg-installer/ffmpeg"
import webp from "node-webpmux"
import { Readable } from "stream"

ffmpeg.setFfmpegPath(ffmpegPath.path)

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
        ? await convertToWebp(buffer, false)
        : await convertToWebp(buffer, true)

    const stickerBuffer = await addExif(webpBuffer, metadata)

    await conn.sendMessage(
      chatId,
      { sticker: stickerBuffer },
      { quoted: msg }
    )

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (e) {
    console.error(e)
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

async function convertToWebp(buffer, isVideo) {
  return new Promise((resolve, reject) => {
    const inputStream = Readable.from(buffer)
    const chunks = []

    const command = ffmpeg(inputStream)
      .inputFormat(isVideo ? "mp4" : "image2pipe")
      .addOutputOptions([
        "-vcodec", "libwebp",
        "-vf",
        "scale=320:320:force_original_aspect_ratio=increase,crop=320:320",
        "-lossless", "1",
        "-qscale", "75"
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

    const output = command.pipe()
    output.on("data", chunk => chunks.push(chunk))
    output.on("error", reject)
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

  const jsonBuff = Buffer.from(JSON.stringify(json))
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)

  const img = new webp.Image()
  await img.load(webpBuffer)
  img.exif = exif

  const result = await img.save(null)
  return Buffer.isBuffer(result) ? result : webpBuffer
}