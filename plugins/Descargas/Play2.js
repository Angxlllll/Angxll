import fetch from 'node-fetch'
import axios from 'axios'

const handler = async (msg, { conn, args, usedPrefix }) => {

  const query = args.join(' ').trim()

  if (!query) {
    return conn.sendMessage(
      msg.chat,
      { text: `❌ Escribe el nombre del video\n\nEjemplo:\n${usedPrefix}play2 bad bunny` },
      { quoted: msg }
    )
  }

  try {

    await conn.sendMessage(msg.chat, {
      react: { text: '🔥', key: msg.key }
    })

    const video = await searchYT(query)

    if (!video) throw 'No se encontró el video'

    const { data } = await axios.get(
      `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(video.url)}`
    )

    if (!data?.result?.download_url) throw 'La API no devolvió descarga'

    const caption =
`╔✦★✦════════════✦★✦╗
🎬 ${video.title}
📺 ${video.channel}
⏱️ ${video.duration}
╚✦★✦════════════✦★✦╝`

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: data.result.download_url },
        mimetype: 'video/mp4',
        fileName: video.title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) + '.mp4',
        caption
      },
      { quoted: msg }
    )

  } catch (e) {

    await conn.sendMessage(
      msg.chat,
      { text: `❌ Error\n${e}` },
      { quoted: msg }
    )

  }

}

handler.help = ['play2 <titulo>']
handler.tags = ['download']
handler.command = ['play2']

export default handler


async function searchYT(q) {

  const res = await fetch(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
    {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
  )

  const html = await res.text()

  const match = html.match(/"videoId":"(.*?)"/)

  if (!match) return null

  const id = match[1]

  const url = 'https://www.youtube.com/watch?v=' + id

  return {
    url,
    title: 'YouTube Video',
    channel: 'YouTube',
    duration: 'N/A'
  }

}