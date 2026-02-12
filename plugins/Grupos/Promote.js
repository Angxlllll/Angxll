const handler = async (m, { conn, participants }) => {
  const target =
    m.mentionedJid?.[0] ||
    m.quoted?.sender

  if (!target)
    return conn.sendMessage(
      m.chat,
      { text: '☁️ *Responde o menciona al usuario*.' },
      { quoted: m }
    )

  let participant
  for (let i = 0, l = participants.length; i < l; i++) {
    if (participants[i].id === target) {
      participant = participants[i]
      break
    }
  }

  if (!participant)
    return conn.sendMessage(
      m.chat,
      { text: '❌ Usuario no encontrado en el grupo.' },
      { quoted: m }
    )

  if (participant.admin)
    return conn.sendMessage(
      m.chat,
      {
        text: `ℹ️ @${target.slice(0, target.indexOf('@'))} *ya era admin*.`,
        mentions: [target]
      },
      { quoted: m }
    )

  await conn.groupParticipantsUpdate(
    m.chat,
    [target],
    'promote'
  )

  return conn.sendMessage(
    m.chat,
    {
      text: `✅ *Admin dado a:* @${target.slice(0, target.indexOf('@'))}`,
      mentions: [target]
    },
    { quoted: m }
  )
}

handler.group = true
handler.admin = true
handler.command = ['promote']
handler.help = ['promote']
handler.tags = ['grupos']

export default handler