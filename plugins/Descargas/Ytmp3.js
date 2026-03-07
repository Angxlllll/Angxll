import ytdl from "@distube/ytdl-core"

function isYouTube(url = "") {
  return ytdl.validateURL(url)
}

const handler = async (m, { conn, args, usedPrefix, command }) => {

  const url = args[0]

  if (!url || !isYouTube(url)) {
    return conn.sendMessage(
      m.chat,
      { text: `✳️ Usa:\n${usedPrefix + command} <link de YouTube>` },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, {
    react: { text: "🎧", key: m.key }
  })

  try {

    const info = await ytdl.getInfo(url)

    const title = info.videoDetails.title
      .replace(/[\\/:*?"<>|]/g, "")
      .slice(0, 80)

    const audio = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly"
    })

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: audio.url },
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`
      },
      { quoted: m }
    )

  } catch (e) {

    await conn.sendMessage(
      m.chat,
      { text: `❌ Error:\n${e.message}` },
      { quoted: m }
    )

  }

}

handler.command = ["ytmp3"]
handler.tags = ["descargas"]
handler.help = ["ytmp3 <url>"]

export default handler