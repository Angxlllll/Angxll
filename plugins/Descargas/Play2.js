import fetch from 'node-fetch'
import axios from 'axios'

const UA = {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'accept-language': 'en-US,en;q=0.9'
  }
}

const handler = async (msg, { conn, args, usedPrefix }) => {

  const q = args.join(' ')
  if (!q) {
    return conn.sendMessage(
      msg.chat,
      { text: `❌ Escribe un video\nEjemplo:\n${usedPrefix}play2 bad bunny` },
      { quoted: msg }
    )
  }

  try {

    await conn.sendMessage(msg.chat, {
      react: { text: '🔥', key: msg.key }
    })

    const id = await searchYT(q)
    if (!id) throw 'No se encontró video'

    const url = `https://www.youtube.com/watch?v=${id}`

    const { data } = await axios.get(
      `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`,
      { timeout: 15000 }
    )

    const dl = data?.result?.download_url
    if (!dl) throw 'API sin descarga'

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: dl },
        mimetype: 'video/mp4',
        fileName: `${id}.mp4`,
        caption: `🎬 https://youtu.be/${id}`
      },
      { quoted: msg }
    )

  } catch (e) {

    conn.sendMessage(
      msg.chat,
      { text: `❌ ${e}` },
      { quoted: msg }
    )

  }

}

handler.command = ['play2']
handler.tags = ['download']
handler.help = ['play2 <titulo>']

export default handler


async function searchYT(q) {

  const res = await fetch(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
    UA
  )

  const html = await res.text()

  const id = html.match(/"videoId":"([^"]{11})"/)?.[1]

  return id || null
}