import axios from "axios"
import yts from "yt-search"

const API_BASE_GLOBAL = (global.APIs?.may || "").replace(/\/+$/, "")
const API_KEY_GLOBAL = global.APIKeys?.may || ""

const TIMEOUT_MS = 60000

async function sendFast(conn, msg, video, caption) {
  const res = await axios.get(`${API_BASE_GLOBAL}/ytdl`, {
    params: { url: video.url, type: "mp4", apikey: API_KEY_GLOBAL },
    timeout: 20000
  })

  if (!res?.data?.status || !res.data.result?.url) throw new Error("Fast failed")

  await conn.sendMessage(
    msg.chat,
    {
      video: { url: res.data.result.url },
      mimetype: "video/mp4",
      caption
    },
    { quoted: msg }
  )
}

async function sendSafe(conn, msg, video, caption) {
  const api = `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(video.url)}`
  
  const { data } = await axios.get(api, {
    timeout: 30000,
    validateStatus: () => true
  })

  if (!data?.status || !data?.result?.download_url) {
    throw new Error("Safe failed")
  }

  await conn.sendMessage(
    msg.chat,
    {
      video: { url: data.result.download_url },
      mimetype: "video/mp4",
      fileName: sanitizeFilename(video.title) + ".mp4",
      caption
    },
    { quoted: msg }
  )
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

  let finished = false

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      if (!finished) reject(new Error("Tiempo de espera agotado"))
    }, TIMEOUT_MS)
  )

  try {
    await Promise.race([
      (async () => {
        const search = await yts(query)
        const video = search.videos?.[0]
        if (!video) throw new Error("Sin resultados")

        const caption =
`🎬 *${video.title}*
📺 ${video.author?.name || "—"}
⏱ ${video.timestamp || "--:--"}`

        try {
          await sendFast(conn, msg, video, caption)
          finished = true
          return
        } catch {}

        await sendSafe(conn, msg, video, caption)
        finished = true
      })(),
      timeoutPromise
    ])
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

function sanitizeFilename(name = "video") {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 100)
}