import fs from 'fs/promises'
import path from 'path'

const handler = async (m, { conn }) => {
  conn.sendMessage(m.chat, {
    react: { text: '🧹', key: m.key }
  }).catch(() => {})

  const sessionPath = path.join('./', global.sessions)

  try {
    const exists = await fs
      .access(sessionPath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      const fquote = await global.getFakeQuote(m, conn)
      return conn.sendMessage(
        m.chat,
        { text: '🏞️ La carpeta de sesiones no existe.' },
        { quoted: fquote }
      )
    }

    const files = await fs.readdir(sessionPath)
    let eliminados = 0

    await Promise.all(
      files.map(async (file) => {
        if (file === 'creds.json') return

        const fullPath = path.join(sessionPath, file)
        const stat = await fs.lstat(fullPath)

        if (stat.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true })
        } else {
          await fs.unlink(fullPath)
        }

        eliminados++
      })
    )

    const fquote = await global.getFakeQuote(m, conn)

    if (!eliminados) {
      return conn.sendMessage(
        m.chat,
        { text: '🏞️ No había sesiones para eliminar.' },
        { quoted: fquote }
      )
    }

    return conn.sendMessage(
      m.chat,
      {
        text:
          `🏞️ Se eliminaron correctamente *${eliminados}* sesiones.\n` +
          `📁 creds.json fue conservado.\n\n` +
          `🏞️ *¿Hola? ¿Ya me ves activo?*`
      },
      { quoted: fquote }
    )
  } catch (e) {
    const fquote = await global.getFakeQuote(m, conn)

    return conn.sendMessage(
      m.chat,
      { text: '🏞️ Ocurrió un error limpiando las sesiones.' },
      { quoted: fquote }
    )
  }
}

handler.help = ['𝖣𝗌𝗈𝗐𝗇𝖾𝗋']
handler.tags = ['𝖮𝖶𝖭𝖤𝖱']
handler.command = ['delai', 'dsowner', 'ds']
handler.owner = true

export default handler