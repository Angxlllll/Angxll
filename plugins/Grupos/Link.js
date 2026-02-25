const handler = async (m, { conn }) => {
  const chat = m.chat

  await conn.sendMessage(chat, {
    react: { text: "🔗", key: m.key }
  })

  try {
    const inviteCode = await conn.groupInviteCode(chat).catch(() => null)
    if (!inviteCode) return

    const link = `https://chat.whatsapp.com/${inviteCode}`

    const ppUrl = await conn.profilePictureUrl(chat, "image").catch(() => null)

    if (ppUrl) {
      await conn.sendMessage(chat, {
        image: { url: ppUrl },
        caption: `${link}`
      }, { quoted: m })
    } else {
      await conn.sendMessage(chat, {
        text: link
      }, { quoted: m })
    }

  } catch (err) {
    console.error("Error en comando link:", err)
  }
}

handler.help = ["link"]
handler.tags = ["grupos"]
handler.command = ['link']
handler.group = true

export default handler