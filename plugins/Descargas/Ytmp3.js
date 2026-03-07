import fetch from "node-fetch"
import crypto from "crypto"

function isYouTube(url = "") {
  return /^https?:\/\//i.test(url) &&
         /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url)
}

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const url = args[0]
  if (!url || !isYouTube(url)) {
    return conn.sendMessage(
      m.chat,
      { text: `✳️ Usa:\n${usedPrefix}${command} <link de YouTube>` },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, { react: { text: "🎧", key: m.key } })

  try {
    const dl = await savetube.download(url)
    if (!dl.status) throw dl.error

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: dl.result.download },
        mimetype: "audio/mpeg",
        fileName: `${sanitize(dl.result.title)}.mp3`
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

handler.command = ["ytmp3"]
handler.tags = ["descargas"]
handler.help = ["ytmp3 <url>"]

export default handler

function sanitize(name = "audio") {
  return name.replace(/[\\/:*?"<>|]+/g, "").slice(0, 100)
}

const savetube = {
  key: Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex"),

  host: "cdn.savetube.vip",

  headers: {
    "content-type": "application/json",
    origin: "https://save-tube.com",
    referer: "https://save-tube.com/",
    "user-agent": "Mozilla/5.0"
  },

  decrypt(enc) {
    const b = Buffer.from(enc.replace(/\s/g, ""), "base64")
    const iv = b.subarray(0, 16)
    const data = b.subarray(16)
    const d = crypto.createDecipheriv("aes-128-cbc", this.key, iv)
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString())
  },

  async download(url) {
    try {

      const info = await fetch(`https://${this.host}/v2/info`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ url })
      }).then(r => r.json())

      if (!info?.status) {
        return { status: false, error: "Info error" }
      }

      const json = this.decrypt(info.data)

      const format =
        json.audio_formats?.find(v => v.quality === 128) ||
        json.audio_formats?.[0]

      if (!format) {
        return { status: false, error: "Audio no disponible" }
      }

      const dl = await fetch(`https://${this.host}/download`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          id: json.id,
          key: json.key,
          downloadType: "audio",
          quality: String(format.quality)
        })
      }).then(r => r.json())

      const link = dl?.data?.downloadUrl

      if (!link) {
        return { status: false, error: "Link error" }
      }

      return {
        status: true,
        result: {
          title: json.title,
          download: link
        }
      }

    } catch (e) {
      return { status: false, error: e.message }
    }
  }
}