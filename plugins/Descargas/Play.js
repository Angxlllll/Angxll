import axios from "axios"
import NodeCache from "node-cache"
import http from "http"
import https from "https"

const searchCache = new NodeCache({ stdTTL: 600 })
const audioCache = new NodeCache({ stdTTL: 3600 })

const axiosClient = axios.create({
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json"
  },
  timeout: 15000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
})

const YT_SEARCH =
"https://www.youtube.com/youtubei/v1/search?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vzJqR0CqA"

async function searchYouTube(q) {

  const cached = searchCache.get(q)
  if (cached) return cached

  const body = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20240207.00.00"
      }
    },
    query: q
  }

  const { data } = await axiosClient.post(YT_SEARCH, body)

  const sections =
    data?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents

  if (!sections) return null

  for (const sec of sections) {

    const items = sec?.itemSectionRenderer?.contents
    if (!items) continue

    for (const v of items) {

      const id = v?.videoRenderer?.videoId

      if (id) {
        searchCache.set(q, id)
        return id
      }

    }

  }

  return null
}

async function resolveAudio(id) {

  const cached = audioCache.get(id)
  if (cached) return cached

  const url = "https://youtu.be/" + id

  try {

    const { data } = await axiosClient.get(
      "https://api-adonix.ultraplus.click/download/ytaudio",
      {
        params: {
          url,
          apikey: "Angxlllll"
        }
      }
    )

    const dl =
      data?.data?.url ||
      data?.datos?.url ||
      data?.result?.url ||
      null

    if (dl) audioCache.set(id, dl)

    return dl

  } catch {

    return null

  }
}

const handler = async (m, { conn, args, usedPrefix }) => {

  const q = args.join(" ").trim()

  if (!q)
    return global.replyWithQuote(
      conn,
      m,
      `❌ Ejemplo:\n${usedPrefix}play bad bunny`
    )

  try {

    global.react(conn, m, "🔎")

    const id = await searchYouTube(q)

    if (!id)
      throw new Error("No se encontró audio")

    global.react(conn, m, "⬇️")

    const dl = await resolveAudio(id)

    if (!dl)
      throw new Error("No hay descarga disponible")

    const quoted = await global.getFakeQuote(m, conn)

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: dl },
        mimetype: "audio/mpeg",
        ptt: false
      },
      { quoted }
    )

    global.react(conn, m, "✅")

  } catch (e) {

    global.replyWithQuote(
      conn,
      m,
      "❌ Error: " + (e?.message || e)
    )

  }

}

handler.command = ["play", "yt", "mp3"]
handler.tags = ["download"]
handler.help = ["play <canción>"]

export default handler