import yts from 'yt-search'
import axios from 'axios'

const handler = async (msg, { conn, args, usedPrefix }) => {
  const query = args.join(' ').trim()

  if (!query) {
    return conn.sendMessage(
      msg.chat,
      { text: `❌ *Error*\n> Escribe el nombre del video.\n\n✳️ Ejemplo:\n${usedPrefix}play2 bad bunny` },
      { quoted: msg }
    )
  }

  try {

    // reacción 🔥
    await conn.sendMessage(msg.chat, {
      react: { text: "🔥", key: msg.key }
    })

    const search = await yts(query)
    if (!search.videos.length) throw 'No se encontró el video.'

    const video = search.videos[0]
    const url = video.url

    // API descarga
    const api = `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`
    const { data } = await axios.get(api)

    if (!data?.status || !data?.result?.download_url)
      throw 'La API no devolvió descarga.'

    const caption = formatBox(video)

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: data.result.download_url },
        mimetype: 'video/mp4',
        fileName: sanitizeFilename(video.title) + '.mp4',
        caption
      },
      { quoted: msg }
    )

  } catch (e) {
    conn.sendMessage(
      msg.chat,
      { text: `❌ Error:\n${e}` },
      { quoted: msg }
    )
  }
}

handler.help = ['play2 <titulo>']
handler.tags = ['download']
handler.command = ['play2']

export default handler


function sanitizeFilename(name = 'video') {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100)
}

function formatBox(video) {

  const title = video.title || 'Desconocido'
  const author = video.author?.name || 'Desconocido'
  const time = video.timestamp || 'N/A'
  const views = video.views?.toLocaleString() || 'N/A'

  const line = '════════════'

  return `╔✦★✦${line}✦★✦╗
🎬 ${title}
📺 ${author}
⏱️ ${time}
👁️ ${views}
╚✦★✦${line}✦★✦╝`
}