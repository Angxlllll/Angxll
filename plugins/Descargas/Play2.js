import yts from 'yt-search'
import axios from 'axios'

const APIs = [
  url => `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`,
  url => `https://api.savetube.me/download/video/720/${encodeURIComponent(url)}`,
  url => `https://ytdl.yt1s.com/api/ajaxSearch/index?query=${encodeURIComponent(url)}&vt=home`
]

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

    const { videos } = await yts(query)
    const v = videos?.[0]

    if (!v) throw 'No se encontró el video'

    const download = await getVideo(v.url)

    if (!download) throw 'Ninguna API devolvió descarga'

    const caption =
`╔✦★✦════════════✦★✦╗
🎬 ${v.title}
📺 ${v.author?.name || 'Desconocido'}
⏱️ ${v.timestamp || 'N/A'}
👁️ ${v.views?.toLocaleString() || 'N/A'}
╚✦★✦════════════✦★✦╝`

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: download },
        mimetype: 'video/mp4',
        fileName: sanitize(v.title) + '.mp4',
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


async function getVideo(url) {

  for (const api of APIs) {

    try {

      const { data } = await axios.get(api(url), { timeout: 15000 })

      const link =
        data?.result?.download_url ||
        data?.data?.downloadUrl ||
        data?.link

      if (link) return link

    } catch {}

  }

  return null
}

function sanitize(name = 'video') {
  return name.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)
}