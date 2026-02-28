import axios from "axios"
import yts from "yt-search"
import http from "http"
import https from "https"

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10
})

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10
})

const axiosFast = axios.create({
  httpAgent,
  httpsAgent
})

const axiosSafe = axios.create({
  httpAgent,
  httpsAgent
})

const API_BASE = (global.APIs?.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys?.may || ""
const TIMEOUT_MS = 60000

async function getFastUrl(videoUrl) {
  if (!API_BASE || !API_KEY) return null

  try {
    const { data } = await axiosFast.get(`${API_BASE}/ytdl`, {
      params: {
        url: videoUrl,
        type: "mp4",
        apikey: API_KEY
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      },
      timeout: 20000
    })

    if (data?.status && data?.result?.url)
      return data.result.url

  } catch {}

  return null
}

async function getSafeUrl(videoUrl) {
  try {
    const api = `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(videoUrl)}`
    const { data } = await axiosSafe.get(api, { timeout: 20000 })

    if (data?.status && data?.result?.download_url)
      return data.result.download_url

  } catch {}

  return null
}

const handler = async (msg, { conn, args, usedPrefix, command }) => {

  const chatId = msg.key.remoteJid
  const query = args.join(" ").trim()

  if (!query)
    return conn.sendMessage(chatId, {
      text: `🌊 Usa:\n${usedPrefix}${command} <nombre del video>`
    }, { quoted: msg })

  await conn.sendMessage(chatId, {
    react: { text: "🎬", key: msg.key }
  })

  try {

    const search = await yts(query)
    if (!search?.videos?.length)
      throw new Error("No se encontraron resultados")

    const video = search.videos[0]

    const title     = video.title
    const author    = video.author?.name || "Desconocido"
    const duration  = video.timestamp || "Desconocida"
    const videoLink = video.url

    const caption = `
🎬 *${title}*
📺 ${author}
⏱ ${duration}
`.trim()

    const downloadUrl = await Promise.any([
      getFastUrl(videoLink),
      getSafeUrl(videoLink)
    ])

    if (!downloadUrl)
      throw new Error("No se pudo obtener el video")

    await conn.sendMessage(chatId, {
      video: { url: downloadUrl },
      caption,
      mimetype: "video/mp4"
    }, { quoted: msg })

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    })

  } catch (err) {

    await conn.sendMessage(chatId, {
      text: `❌ Error: ${err?.message || "Fallo interno"}`
    }, { quoted: msg })

  }
}

handler.command = ["play2"]
handler.help    = ["play2 <texto>"]
handler.tags    = ["descargas"]

export default handler