import yts from 'yt-search'
import axios from 'axios'
import crypto from 'crypto'

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/json'
}

const handler = async (msg, { conn, args, usedPrefix, command }) => {
  const query = args.join(" ").trim()
  if (!query) {
    return conn.sendMessage(
      msg.chat,
      { text: `✳️ Usa:\n${usedPrefix}${command} <nombre del video>` },
      { quoted: msg }
    )
  }

  await m.reply('*🔍 Buscando audio...*')

  try {
    const search = await yts(args)
    if (!search.videos.length) throw new Error('No se encontró el audio.')

    const video = search.videos[0]
    const url = video.url

    await m.reply('*🎧 Descargando audio...*')

    const dl = await savetube.download(url)
    if (!dl.status) throw new Error(dl.error || 'Error en descarga.')

    await conn.sendMessage(m.chat, {
      audio: { url: dl.result.download },
      mimetype: 'audio/mpeg',
      fileName: `${sanitizeFilename(dl.result.title)}.mp3`
    }, { quoted: m })

  } catch (e) {
    await m.reply(`❌ Error:\n${e.message}`)
  }
}

handler.help = ['play <título>', 'ytmp3 <título>']
handler.tags = ['download']
handler.command = ['play', 'ytmp3']
handler.limit = true
handler.daftar = true

export default handler

function sanitizeFilename(name = 'audio') {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100)
}

const savetube = {
  key: Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex'),

  decrypt: (enc) => {
    const b = Buffer.from(enc.replace(/\s/g, ''), 'base64')
    const iv = b.subarray(0, 16)
    const data = b.subarray(16)
    const d = crypto.createDecipheriv('aes-128-cbc', savetube.key, iv)
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString())
  },

  download: async (url) => {
    try {
      const random = await axios.get('https://media.savetube.vip/api/random-cdn', {
        headers: { 'User-Agent': BASE_HEADERS['User-Agent'] }
      })

      const cdn = random.data.cdn

      const info = await axios.post(`https://${cdn}/v2/info`, { url }, {
        headers: BASE_HEADERS
      })

      if (!info.data?.status) {
        return { status: false, error: 'Video no encontrado en API.' }
      }

      const json = savetube.decrypt(info.data.data)

      const format = json.audio_formats.find(a => a.quality === 128) || json.audio_formats[0]
      if (!format) return { status: false, error: 'Formato no disponible.' }

      const dlRes = await axios.post(`https://${cdn}/download`, {
        id: json.id,
        key: json.key,
        downloadType: 'audio',
        quality: String(format.quality)
      }, {
        headers: BASE_HEADERS
      })

      const downloadUrl = dlRes.data?.data?.downloadUrl
      if (!downloadUrl) {
        return { status: false, error: 'No se pudo generar el enlace.' }
      }

      return {
        status: true,
        result: {
          title: json.title,
          download: downloadUrl
        }
      }

    } catch (e) {
      return { status: false, error: e.message }
    }
  }
}