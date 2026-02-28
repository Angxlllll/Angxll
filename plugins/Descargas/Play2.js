import axios from "axios"
import yts from "yt-search"
import http from "http"
import https from "https"

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000
})

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000
})

const axiosInstance = axios.create({
  httpAgent,
  httpsAgent
})

const API_BASE_GLOBAL = (global.APIs?.may || "").replace(/\/+$/, "")
const API_KEY_GLOBAL = global.APIKeys?.may || ""
const TIMEOUT_MS = 60000

async function getFastUrl(url) {
  if (!API_BASE_GLOBAL || !API_KEY_GLOBAL) return null
  try {
    const { data } = await axiosInstance.get(`${API_BASE_GLOBAL}/ytdl`, {
      params: { url, type: "mp4", apikey: API_KEY_GLOBAL },
      timeout: 15000
    })
    if (data?.status && data?.result?.url) return data.result.url
  } catch {}
  return null
}

async function getSafeUrl(url) {
  try {
    const api = `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`
    const { data } = await axiosInstance.get(api, { timeout: 20000 })
    if (data?.status && data?.result?.download_url)
      return data.result.download_url
  } catch {}
  return null
}

const handler = async (msg, { conn, args, usedPrefix, command }) => {
  const query = args.join(" ").trim()

  if (!query) {
    return conn.sendMessage(
      msg.chat,
      { text: `✳️ Usa:\n${usedPrefix}${command} <nombre del video>` },
      { quoted: msg }
    )
  }

  await conn.sendMessage(msg.chat, {
    react: { text: "🎬", key: msg.key }
  })

  try {
    let video
    let videoUrl

    if (query.startsWith("http")) {
      videoUrl = query
      video = { title: "Descargando...", author: {}, timestamp: "" }
    } else {
      const search = await yts(query)
      video = search.videos?.[0]
      videoUrl = video?.url
    }

    if (!videoUrl) throw new Error("Sin resultados")

    const caption =
`🎬 *${video.title || "Video"}*
📺 ${video.author?.name || "—"}
⏱ ${video.timestamp || "--:--"}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const downloadUrl = await Promise.any([
      getFastUrl(videoUrl),
      getSafeUrl(videoUrl)
    ])

    clearTimeout(timeout)

    if (!downloadUrl) throw new Error("No se pudo obtener el video")

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: downloadUrl },
        mimetype: "video/mp4",
        caption
      },
      { quoted: msg }
    )

  } catch (err) {
    await conn.sendMessage(
      msg.chat,
      { text: `❌ Error: ${err?.message || "Fallo interno"}` },
      { quoted: msg }
    )
  }
}

handler.command = ["play2"]
handler.help = ["play2 <texto>"]
handler.tags = ["descargas"]

export default handler