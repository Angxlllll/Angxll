import yts from 'yt-search'
import axios from 'axios'
import crypto from 'crypto'

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/json'
}

const handler = async (m, { conn, text, command, usedPrefix }) => {
  if (!text)
    return conn.sendMessage(m.chat, {
      text: `✳️ Ingresa el nombre del audio.\nEjemplo: *${usedPrefix + command} Confess your love*`
    }, { quoted: m })

  await conn.sendMessage(m.chat, {
    text: '*🎧 Descargando audio...*'
  }, { quoted: m })

  try {
    const search = await yts(text)
    if (!search.videos?.length)
      throw new Error('No se encontró el audio.')

    const url = search.videos[0].url

    const dl = await savetube.download(url)
    if (!dl.status)
      throw new Error(dl.error || 'Error en descarga.')

    await conn.sendMessage(m.chat, {
      audio: { url: dl.result.download },
      mimetype: 'audio/mpeg',
      fileName: `${sanitizeFilename(dl.result.title)}.mp3`
    }, { quoted: m })

  } catch (e) {
    await conn.sendMessage(m.chat, {
      text: `❌ Error:\n${e.message}`
    }, { quoted: m })
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

  decrypt(enc) {
    const buffer = Buffer.from(enc.replace(/\s/g, ''), 'base64')
    const iv = buffer.subarray(0, 16)
    const data = buffer.subarray(16)
    const decipher = crypto.createDecipheriv('aes-128-cbc', this.key, iv)
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString())
  },

  async download(url) {
    try {
      const { data: random } = await axios.get(
        'https://media.savetube.vip/api/random-cdn',
        { headers: { 'User-Agent': BASE_HEADERS['User-Agent'] } }
      )

      const cdn = random?.cdn
      if (!cdn) return { status: false, error: 'No se obtuvo CDN.' }

      const { data: info } = await axios.post(
        `https://${cdn}/v2/info`,
        { url },
        { headers: BASE_HEADERS }
      )

      if (!info?.status)
        return { status: false, error: 'Video no disponible en API.' }

      const json = this.decrypt(info.data)

      const { data: dl } = await axios.post(
        `https://${cdn}/download`,
        {
          id: json.id,
          key: json.key,
          downloadType: 'audio'
        },
        { headers: BASE_HEADERS }
      )

      const downloadUrl = dl?.data?.downloadUrl
      if (!downloadUrl)
        return { status: false, error: 'No se pudo generar enlace.' }

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