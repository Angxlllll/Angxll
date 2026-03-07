import axios from "axios"

const UA = {
  headers: {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json"
  },
  timeout: 15000
}

const YT_SEARCH = "https://www.youtube.com/youtubei/v1/search?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vzJqR0CqA"

async function searchYouTube(q) {
  const body = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240207.00.00"
      }
    },
    query: q
  }

  const { data } = await axios.post(YT_SEARCH, body, UA)

  const items =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents || []

  for (const sec of items) {
    const vids = sec.itemSectionRenderer?.contents || []
    for (const v of vids) {
      const id = v.videoRenderer?.videoId
      if (id) return id
    }
  }

  return null
}

async function resolveDownload(id) {

  const url = "https://youtu.be/" + id

  const apis = [

    async () => {
      const { data } = await axios.get(
        "https://api-faa.my.id/faa/ytmp4?url=" + url,
        { timeout: 15000 }
      )
      return data?.result?.download_url
    },

    async () => {
      const { data } = await axios.get(
        "https://api.ryzendesu.vip/api/downloader/ytmp4?url=" + url,
        { timeout: 15000 }
      )
      return data?.url
    }

  ]

  for (const fn of apis) {
    try {
      const dl = await fn()
      if (dl) return dl
    } catch {}
  }

  return null
}

const handler = async (m, { conn, args, usedPrefix }) => {

  const q = args.join(" ").trim()

  if (!q) {
    return global.replyWithQuote(
      conn,
      m,
      `❌ Escribe un video\nEjemplo:\n${usedPrefix}play2 bad bunny`
    )
  }

  try {

    global.react(conn, m, "🔎")

    const id = await searchYouTube(q)

    if (!id)
      throw new Error("No se encontró video")

    global.react(conn, m, "⬇️")

    const dl = await resolveDownload(id)

    if (!dl)
      throw new Error("No hay descarga disponible")

    const quoted = await global.getFakeQuote(m, conn)

    await conn.sendMessage(
      m.chat,
      {
        video: { url: dl },
        mimetype: "video/mp4",
        fileName: id + ".mp4",
        caption: "🎬 https://youtu.be/" + id
      },
      { quoted }
    )

    global.react(conn, m, "✅")

  } catch (e) {

    return global.replyWithQuote(
      conn,
      m,
      "❌ Error: " + (e?.message || e)
    )

  }

}

handler.command = ["play2"]
handler.tags = ["download"]
handler.help = ["play2 <titulo>"]

export default handler