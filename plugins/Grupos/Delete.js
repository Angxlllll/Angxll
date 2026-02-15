const handler = async (m, { conn }) => {
  if (!m.quoted)
    return m.reply('Responde al mensaje que deseas eliminar.')

  try {
    await conn.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        id: m.quoted.key.id,
        fromMe: m.quoted.key.fromMe,
        participant: m.quoted.key.participant
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
    await m.reply('No se pudo eliminar el mensaje.')
  }
}

handler.help = ["𝖣𝖾𝗅𝖾𝗍𝖾"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.command = ['del', 'delete']
handler.group = true
handler.admin = true
export default handler