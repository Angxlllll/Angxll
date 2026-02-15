const handler = async (m, { conn }) => {
  if (!m.quoted)
    return conn.sendMessage(
      m.chat,
      { text: 'Responde al mensaje que deseas eliminar.' },
      { quoted: m }
    )

  try {
    const q = m.quoted
    const key = q.key || {}

    await conn.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        id: key.id,
        fromMe: key.fromMe,
        participant: key.participant || q.sender
      }
    })

    await conn.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        id: m.key.id,
        fromMe: true
      }
    })

  } catch {
    await conn.sendMessage(
      m.chat,
      { text: 'No se pudo eliminar el mensaje.' },
      { quoted: m }
    )
  }
}

handler.help = ["delete"]
handler.tags = ["grupos"]
handler.command = ["del", "delete"]
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler