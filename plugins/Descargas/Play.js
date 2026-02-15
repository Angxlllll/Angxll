"use strict"

import yts from "yt-search"
import axios from "axios"
import crypto from "crypto"
import fetch from "node-fetch"

const savetube = {
  key: Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex"),

  decrypt(enc) {
    const b = Buffer.from(enc.replace(/\s/g, ""), "base64")
    const iv = b.subarray(0, 16)
    const data = b.subarray(16)
    const d = crypto.createDecipheriv("aes-128-cbc", this.key, iv)
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString())
  },

  async audio(url) {
    const { data: random } = await axios.get("https://media.savetube.vip/api/random-cdn")
    const cdn = random.cdn

    const info = await axios.post(`https://${cdn}/v2/info`, { url })
    if (!info.data?.status) throw "savetube info error"

    const json = this.decrypt(info.data.data)
    const format = json.audio_formats.find(a => a.quality === 128) || json.audio_formats[0]
    if (!format) throw "savetube audio error"

    const dl = await axios.post(`https://${cdn}/download`, {
      id: json.id,
      key: json.key,
      downloadType: "audio",
      quality: String(format.quality)
    })

    const link = dl.data?.data?.downloadUrl
    if (!link) throw "savetube link error"

    const buff = await fetch(link).then(r => r.arrayBuffer())
    return { title: json.title, buffer: Buffer.from(buff) }
  }
}

const savenow = {
  key: "dfcb6d76f2f6a9894gjkege8a4ab232222",

  async audio(url) {
    const r = await fetch(
      `https://p.savenow.to/ajax/download.php?format=mp3&url=${encodeURIComponent(url)}&api=${this.key}`
    ).then(r => r.json())

    if (!r?.success || !r?.download_url) throw "savenow error"

    const buff = await fetch(r.download_url).then(r => r.arrayBuffer())
    return { title: r.title || "audio", buffer: Buffer.from(buff) }
  }
}

async function downloadAudio(url) {
  return await Promise.any([
    savetube.audio(url),
    savenow.audio(url)
  ])
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const query = args.join(" ").trim()
  if (!query) {
    return conn.sendMessage(
      m.chat,
      { text: `✳️ Usa:\n${usedPrefix}${command} <nombre del audio>` },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, { react: { text: "🎧", key: m.key } })

  try {
    const search = await yts(query)
    const video = search.videos?.[0]
    if (!video) throw "Sin resultados"

    const dl = await downloadAudio(video.url)
    if (!dl?.buffer) throw "No se pudo descargar"

    await conn.sendMessage(
      m.chat,
      {
        audio: dl.buffer,
        mimetype: "audio/mpeg",
        fileName: `${dl.title}.mp3`
      },
      { quoted: m }
    )
  } catch (e) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ Error: ${e}` },
      { quoted: m }
    )
  }
}

handler.command = ["play"]
handler.help = ["play <texto>"]
handler.tags = ["descargas"]

export default handler