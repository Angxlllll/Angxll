import yts from 'yt-search'
import axios from 'axios'

const handler = async (msg, { conn, args, usedPrefix }) => {
  const query = args.join(' ')
  if (!query) {
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

    const r = await yts(query)
    const v = r.videos?.[0]
    if (!v) throw 'No se encontró el video'

    const { data } = await axios.get(
      `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(v.url)}`,
      { timeout: 15000 }
    )

    if (!data?.result?.download_url) throw 'API sin descarga'

    await conn.sendMessage(
      msg.chat,
      {
        video: { url: data.result.download_url },
        mimetype: 'video/mp4',
        fileName: `${v.title}.mp4`,
        caption: `🎬 ${v.title}\n📺 ${v.author?.name}\n⏱️ ${v.timestamp}`
      },
      { quoted: msg }
    )

  } catch (e) {
    conn.sendMessage(msg.chat, { text: `❌ ${e}` }, { quoted: msg })
  }
}

handler.command = ['play2']
handler.tags = ['download']
handler.help = ['play2 <titulo>']

export default handler