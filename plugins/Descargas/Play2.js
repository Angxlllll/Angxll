import fetch from "node-fetch"
import axios from "axios"

const UA = {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept-language": "en-US,en;q=0.9"
  }
}

const sanitizeFilename = (name) => {
  return name
    .replace(/[\\\/:*?"<>|]/g, "")
    .replace(/[^a-zA-Z0-9\s\-_\.]/g, "")
    .substring(0, 64)
    .trim()
}

const handler = async (m, { conn, args, usedPrefix }) => {

  const q = args.join(" ")
  if (!q) {
    return conn.sendMessage(
      m.chat,
      { text: `❌ Escribe un video\nEjemplo:\n${usedPrefix}play2 believer` },
      { quoted: m }
    )
  }

  try {

    await conn.sendMessage(m.chat, {
      react: { text: "🔥", key: m.key }
    })

    const id = await searchYT(q)
    if (!id) throw "No se encontró video"

    const url = `https://www.youtube.com/watch?v=${id}`
    const encoded = encodeURIComponent(url)

    const controller1 = new AbortController()
    const controller2 = new AbortController()
    const controller3 = new AbortController()

    const api1 = axios
      .get(`https://api-faa.my.id/faa/ytmp4?url=${encoded}`, {
        signal: controller1.signal,
        timeout: 15000
      })
      .then(r => {
        const dl = r.data?.result?.download_url
        if (!dl) throw "faa fail"
        return { url: dl, api: "FAA API" }
      })

    const api2 = axios
      .get(`https://nexevo.onrender.com/download/y2?url=${encoded}`, {
        signal: controller2.signal,
        timeout: 15000
      })
      .then(r => {
        const dl = r.data?.result?.url
        if (!dl) throw "nexevo fail"
        return { url: dl, api: "Nexevo API" }
      })

    const api3 = fetch(
      `https://theadonix-api.vercel.app/api/ytmp4?url=${encoded}`,
      { signal: controller3.signal }
    )
      .then(r => r.json())
      .then(r => {
        const dl = r?.result?.video
        if (!dl) throw "adonix fail"
        return { url: dl, api: "Adonix API" }
      })

    const winner = await Promise.any([api1, api2, api3])

    controller1.abort()
    controller2.abort()
    controller3.abort()

    await conn.sendMessage(
      m.chat,
      {
        video: { url: winner.url },
        mimetype: "video/mp4",
        fileName: sanitizeFilename(id) + ".mp4",
        caption:
`🎬 https://youtu.be/${id}

⚡ Api ganadora: ${winner.api}`
      },
      { quoted: m }
    )

  } catch (e) {

    conn.sendMessage(
      m.chat,
      { text: `❌ Error\n${e}` },
      { quoted: m }
    )

  }

}

handler.command = ["play2"]
handler.tags = ["download"]
handler.help = ["play2 <titulo>"]

export default handler


async function searchYT(q) {

  const res = await fetch(
    "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(q),
    UA
  )

  const html = await res.text()

  const id = html.match(/"videoId":"([^"]{11})"/)?.[1]

  return id || null
}