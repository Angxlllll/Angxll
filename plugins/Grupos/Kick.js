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
      { text: '*🗡️ 𝙼𝚎𝚗𝚌𝚒𝚘𝚗𝚊 𝚘 𝚛𝚎𝚜𝚙𝚘𝚗𝚍𝚎 𝚊𝚕 𝚞𝚜𝚞𝚊𝚛𝚒𝚘 𝚚𝚞𝚎 𝚍𝚎𝚜𝚎𝚊𝚜 𝚎𝚕𝚒𝚖𝚒𝚗𝚊𝚛*' },
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

  try {
    await conn.sendMessage(m.chat, {
      react: { text: '🗡️', key: m.key }
    })

    await conn.groupParticipantsUpdate(
      m.chat,
      [participant.id || participant.jid],
      'remove'
    )

    await conn.sendMessage(
      m.chat,
      { text: '*🗡️ 𝚄𝚂𝚄𝙰𝚁𝙸𝙾 𝙴𝙻𝙸𝙼𝙸𝙽𝙰𝙳𝙾*' },
      { quoted: m }
    )
  } catch {
    await conn.sendMessage(
      m.chat,
      { text: '❌ No pude eliminar al usuario.' },
      { quoted: m }
    )
  }
}

handler.command = ['kick']
handler.help = ['kick']
handler.tags = ['grupos']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler