const handler = async (m, { conn, getGroupMeta }) => {
  if (!getGroupMeta) return

  const meta = await getGroupMeta()
  if (!meta?.participants?.length) return

  const participants = meta.participants

  const target =
    m.mentionedJid?.[0] ||
    m.quoted?.sender

  if (!target)
    return conn.sendMessage(
      m.chat,
      { text: '☁️ *Responde o menciona al usuario*.' },
      { quoted: m }
    )

  const participant = participants.find(p =>
    p.id === target || p.jid === target
  )

  if (!participant)
    return conn.sendMessage(
      m.chat,
      { text: '❌ Usuario no encontrado en el grupo.' },
      { quoted: m }
    )

  if (!participant.admin)
    return conn.sendMessage(
      m.chat,
      {
        text: `ℹ️ @${target.split('@')[0]} *no era admin*.`,
        mentions: [target]
      },
      { quoted: m }
    )

  await conn.groupParticipantsUpdate(
    m.chat,
    [target],
    'demote'
  )

  return conn.sendMessage(
    m.chat,
    {
      text: `✅ *Admin removido a:* @${target.split('@')[0]}`,
      mentions: [target]
    },
    { quoted: m }
  )
}

handler.group = true
handler.admin = true
handler.botAdmin = true
handler.command = ['demote']
handler.help = ['demote']
handler.tags = ['grupos']

export default handler