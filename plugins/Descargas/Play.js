import axios from "axios"

const API_URL = "https://api-adonix.ultraplus.click/download/ytaudio"
const API_KEY = "Angxlllll"

const YT_SEARCH =
"https://www.youtube.com/youtubei/v1/search?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vzJqR0CqA"

const axiosClient = axios.create({
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json"
  },
  timeout: 15000
})

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
      if (id) return id

    }

  }

  return null
}

async function resolveDownload(id) {

  const url = "https://youtu.be/" + id

  try {

    const { data } = await axiosClient.get(API_URL, {
      params: {
        url,
        apikey: API_KEY
      }
    })

    return (
      data?.data?.url ||
      data?.datos?.url ||
      data?.result?.url ||
      null
    )

  } catch {

    return null

  }
}

const handler = async (m, { conn, args, usedPrefix }) => {

  const q = args.join(" ").trim()

  if (!q) {

    return global.replyWithQuote(
      conn,
      m,
      `❌ Escribe una canción\nEjemplo:\n${usedPrefix}play bad bunny`
    )

  }

  try {

    global.react(conn, m, "🔎")

    const id = await searchYouTube(q)

    if (!id)
      throw new Error("No se encontró audio")

    global.react(conn, m, "⬇️")

    const dl = await resolveDownload(id)

    if (!dl)
      throw new Error("No hay descarga disponible")

    const quoted = await global.getFakeQuote(m, conn)

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: dl },
        mimetype: "audio/mpeg",
        fileName: `${id}.mp3`,
        ptt: false
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

handler.command = ["play", "yt", "mp3"]
handler.tags = ["download"]
handler.help = ["play <canción>"]

export default handler