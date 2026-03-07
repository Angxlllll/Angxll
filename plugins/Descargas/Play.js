import play from "play-dl"
import NodeCache from "node-cache"

const searchCache = new NodeCache({ stdTTL: 600 })
const audioCache = new NodeCache({ stdTTL: 3600 })

async function searchYouTube(q) {

  const cached = searchCache.get(q)
  if (cached) return cached

  const results = await play.search(q, { limit: 1 })
  if (!results.length) return null

  const url = results[0].url

  searchCache.set(q, url)
  return url

}

async function resolveAudio(url) {

  const cached = audioCache.get(url)
  if (cached) return cached

  const stream = await play.stream(url)

  audioCache.set(url, stream.stream)
  return stream.stream

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

    const url = await searchYouTube(q)

    if (!url)
      throw new Error("No se encontró audio")

    global.react(conn, m, "⬇️")

    const stream = await resolveAudio(url)

    const quoted = await global.getFakeQuote(m, conn)

    await conn.sendMessage(
      m.chat,
      {
        audio: stream,
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