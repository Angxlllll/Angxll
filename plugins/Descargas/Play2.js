import yts from 'yt-search'
import axios from 'axios'

const APIS = [
  {
    name: 'api-faa',
    url: url => `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`,
    parse: d => d?.result?.download_url
  },
  {
    name: 'savetube',
    url: url => `https://api.savetube.me/download/video/720/${encodeURIComponent(url)}`,
    parse: d => d?.data?.downloadUrl
  },
  {
    name: 'yt1s',
    url: url => `https://ytdl.yt1s.com/api/ajaxSearch/index?query=${encodeURIComponent(url)}&vt=home`,
    parse: d => d?.link
  }
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

    const result = await fastestAPI(v.url)

    if (!result) throw 'Ninguna API devolvió descarga'

    const caption =
`╔✦★✦════════════✦★✦╗
🎬 ${v.title}
📺 ${v.author?.name || 'Desconocido'}
⏱️ ${v.timestamp || 'N/A'}
👁️ ${v.views?.toLocaleString() || 'N/A'}
⚡ Descargado por: ${result.api}
╚✦★✦════════════✦★✦╝`

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: result.url },
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


async function fastestAPI(url) {

  const requests = APIS.map(api =>
    axios.get(api.url(url), { timeout: 15000 })
      .then(r => {
        const link = api.parse(r.data)
        if (!link) throw 'no link'
        return { url: link, api: api.name }
      })
  )

  try {
    return await Promise.any(requests)
  } catch {
    return null
  }

}

function sanitize(name = 'video') {
  return name.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80)
}