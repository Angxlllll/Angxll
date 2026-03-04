import axios from 'axios'

const handler = async (msg, { conn, args, usedPrefix }) => {
  const query = args.join(' ').trim()

  if (!query) {
    await conn.sendMessage(
      msg.chat,
      { text: `❌ *Error:*\n> Debes escribir el nombre del audio.\n\n✳️ Usa:\n${usedPrefix}play <nombre>` },
      { quoted: msg }
    )
    return
  }

  await conn.sendMessage(
    msg.chat,
    { text: '🎧 Buscando y descargando audio...' },
    { quoted: msg }
  )

  try {
    // API que busca + devuelve audio
    const api = `https://nexevo-api.vercel.app/play?query=${encodeURIComponent(query)}`
    const { data } = await axios.get(api)

    if (!data?.status || !data?.result?.url)
      throw new Error('No se pudo obtener el audio.')

    const title = data.result.title || 'audio'

    await conn.sendMessage(
      msg.chat,
      {
        audio: { url: data.result.url },
        mimetype: 'audio/mpeg',
        fileName: `${sanitizeFilename(title)}.mp3`
      },
      { quoted: msg }
    )

  } catch (e) {
    await conn.sendMessage(
      msg.chat,
      { text: `❌ Error:\n${e.message}` },
      { quoted: msg }
    )
  }
}

handler.help = ['play <título>']
handler.tags = ['download']
handler.command = ['play', 'ytmp3']

export default handler

function sanitizeFilename(name = 'audio') {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100)
}