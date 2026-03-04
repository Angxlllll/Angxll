const handler = async (m, { conn, isAdmin }) => {
  if (!m.isGroup) return

  if (isAdmin) {
    const fquote = await global.getFakeQuote(m, conn)
    return conn.sendMessage(
      m.chat,
      { text: '*𝖸𝖺 𝖤𝗋𝖾𝗌 𝖠𝖽𝗆𝗂𝗇 𝖩𝖾𝖿𝖾*' },
      { quoted: fquote }
    )
  }

  conn.sendMessage(m.chat, {
    react: { text: '⚙️', key: m.key }
  }).catch(() => {})

  try {
    await conn.groupParticipantsUpdate(
      m.chat,
      [m.sender],
      'promote'
    )

    conn.sendMessage(m.chat, {
      react: { text: '⭐', key: m.key }
    }).catch(() => {})

    const fquote = await global.getFakeQuote(m, conn)

    return conn.sendMessage(
      m.chat,
      { text: '*𝖠𝗁𝗈𝗋𝖺 𝖤𝗋𝖾𝗌 𝖠𝖽𝗆𝗂𝗇 𝖩𝖾𝖿𝖾*' },
      { quoted: fquote }
    )
  } catch {
    conn.sendMessage(m.chat, {
      react: { text: '❌', key: m.key }
    }).catch(() => {})

    const fquote = await global.getFakeQuote(m, conn)

    return conn.sendMessage(
      m.chat,
      { text: '*𝖭𝗈 𝗉𝗎𝖽𝗈 𝖽𝖺𝗋𝗍𝖾 𝖺𝖽𝗆𝗂𝗇*' },
      { quoted: fquote }
    )
  }
}

handler.help = ['𝖠𝗎𝗍𝗈𝖺𝖽𝗆𝗂𝗇']
handler.tags = ['𝖮𝖶𝖭𝖤𝖱']
handler.command = ['autoadmin']
handler.owner = true
handler.group = true
handler.botAdmin = true

export default handler