const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i

const handler = async (m, { conn, args }) => {
  global.react(conn, m, '🔗')

  const text = args.join(' ').trim()
  if (!text) {
    return global.replyWithQuote(
      conn,
      m,
      '𝖨𝗇𝗀𝗋𝖾𝗌𝖺 𝖤𝗅 𝖤𝗇𝗅𝖺𝖼𝖾 𝖣𝖾𝗅 𝖦𝗋𝗎𝗉𝗈 𝖠𝗅 𝖰𝗎𝖾 𝖬𝖾 𝖴𝗇𝗂𝗋𝖾'
    )
  }

  const match = text.match(linkRegex)
  if (!match) {
    return global.replyWithQuote(
      conn,
      m,
      '𝖤𝗇𝗅𝖺𝖼𝖾 𝖨𝗇𝗏𝖺𝗅𝗂𝖽𝗈'
    )
  }

  try {
    await conn.groupAcceptInvite(match[1])
    global.react(conn, m, '✅')

    return global.replyWithQuote(
      conn,
      m,
      '𝖬𝖾 𝖴𝗇𝗂 𝖤𝗑𝗂𝗍𝗈𝗌𝖺𝗆𝖾𝗇𝗍𝖾 𝖠𝗅 𝖦𝗋𝗎𝗉𝗈'
    )
  } catch {
    global.react(conn, m, '❌')

    return global.replyWithQuote(
      conn,
      m,
      '𝖠𝗁 𝖮𝖼𝗎𝗋𝗋𝗂𝖽𝗈 𝖴𝗇 𝖤𝗋𝗋𝗈𝗋 𝖨𝗇𝖾𝗌𝗉𝖾𝗋𝖺𝖽𝗈'
    )
  }
}

handler.command = ['join', 'entrar']
handler.owner = true
export default handler