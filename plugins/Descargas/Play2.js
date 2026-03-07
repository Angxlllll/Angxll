import axios from 'axios'

const UA = {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'accept-language': 'en-US,en;q=0.9'
  },
  timeout: 15000
}

const handler = async (msg, { conn, args, usedPrefix }) => {

  const q = args.join(' ').trim()

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

    const { data } = await axios.get(
      `https://api-faa.my.id/faa/ytmp4?url=https://youtu.be/${id}`,
      UA
    )

    const dl = data?.result?.download_url

    if (!dl) throw 'API sin descarga disponible'

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

  } catch (err) {

    await conn.sendMessage(
      msg.chat,
      { text: `❌ Error: ${err?.message || err}` },
      { quoted: msg }
    )

  }

}

handler.command = ['play2']
handler.tags = ['download']
handler.help = ['play2 <titulo>']

export default handler


async function searchYT(q) {

  const { data } = await axios.get(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
    UA
  )

  const match = data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)

  return match?.[1] || null
}