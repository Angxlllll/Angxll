import axios from "axios"
import fs from "fs"
import path from "path"
import { pipeline } from "stream"
import { promisify } from "util"

const streamPipe = promisify(pipeline)

const API_BASE_GLOBAL = (global.APIs?.may || "").replace(/\/+$/, "")
const API_KEY_GLOBAL = global.APIKeys?.may || ""

const API_BASE_ENV = (process.env.API_BASE || "https://api-sky.ultraplus.click").replace(/\/+$/, "")
const API_KEY_ENV = process.env.API_KEY || "Angxll"

const MAX_MB = 200
const TIMEOUT_MS = 60000
const STREAM_TIMEOUT = 300000

function ensureTmp() {
  const tmp = path.join(process.cwd(), "tmp")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true })
  return tmp
}

function isSkyUrl(url = "") {
  try {
    return new URL(url).host === new URL(API_BASE_ENV).host
  } catch {
    return false
  }
}

function isYouTube(url = "") {
  return /^https?:\/\//i.test(url) &&
    /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url)
}

async function sendFast(conn, m, video, caption) {
  if (!API_BASE_GLOBAL || !API_KEY_GLOBAL) throw new Error("Fast no configurado")

  const res = await axios.get(`${API_BASE_GLOBAL}/ytdl`, {
    params: {
      url: video.url,
      type: "mp4",
      apikey: API_KEY_GLOBAL
    },
    timeout: 20000
  })

  if (!res?.data?.status || !res.data.result?.url) throw new Error("Fast falló")

  await conn.sendMessage(
    m.chat,
    {
      video: { url: res.data.result.url },
      mimetype: "video/mp4",
      caption
    },
    { quoted: m }
  )
}

async function sendSafe(conn, m, video, caption) {
  const r = await axios.post(
    `${API_BASE_ENV}/youtube/resolve`,
    { url: video.url, type: "video" },
    {
      headers: { apikey: API_KEY_ENV },
      validateStatus: () => true
    }
  )

  const data = r.data
  if (!data?.result?.media) throw new Error("Safe falló")

  let dl = data.result.media.dl_download || data.result.media.direct
  if (!dl) throw new Error("Sin URL de descarga")
  if (dl.startsWith("/")) dl = API_BASE_ENV + dl

  const headers = isSkyUrl(dl) ? { apikey: API_KEY_ENV } : {}

  try {
    await conn.sendMessage(
      m.chat,
      {
        video: { url: dl },
        mimetype: "video/mp4",
        caption
      },
      { quoted: m }
    )
    return
  } catch {}

  const tmp = ensureTmp()
  const filePath = path.join(tmp, `${Date.now()}.mp4`)

  const resStream = await axios.get(dl, {
    responseType: "stream",
    timeout: STREAM_TIMEOUT,
    headers,
    validateStatus: () => true
  })

  if (resStream.status >= 400) throw new Error(`HTTP_${resStream.status}`)

  let size = 0
  const writeStream = fs.createWriteStream(filePath)

  resStream.data.on("data", chunk => {
    size += chunk.length
    if (size / 1024 / 1024 > MAX_MB) {
      resStream.data.destroy()
      writeStream.destroy()
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      throw new Error("Video demasiado grande")
    }
  })

  await streamPipe(resStream.data, writeStream)

  await conn.sendMessage(
    m.chat,
    {
      video: { stream: fs.createReadStream(filePath), length: size },
      mimetype: "video/mp4",
      caption
    },
    { quoted: m }
  )

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const url = args[0]
  if (!isYouTube(url)) {
    return conn.sendMessage(
      m.chat,
      { text: `✳️ Usa:\n${usedPrefix}${command} <link de YouTube>` },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, {
    react: { text: "🎬", key: m.key }
  })

  let finished = false

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      if (!finished) reject(new Error("Tiempo de espera agotado"))
    }, TIMEOUT_MS)
  )

  try {
    await Promise.race([
      (async () => {
        const video = {
          url,
          title: "YouTube Video",
          author: { name: "YouTube" },
          timestamp: "--:--"
        }

        const caption =
          `🎬 *YouTube Video*\n` +
          `🎥 YouTube\n` +
          `⏱ --:--`

        try {
          await sendFast(conn, m, video, caption)
          finished = true
          return
        } catch {}

        await sendSafe(conn, m, video, caption)
        finished = true
      })(),
      timeoutPromise
    ])
  } catch (err) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ Error: ${err?.message || "Fallo interno"}` },
      { quoted: m }
    )
  }
}

handler.command = ["ytmp4"]
handler.help = ["ytmp4"]
handler.tags = ["descargas"]

export default handler