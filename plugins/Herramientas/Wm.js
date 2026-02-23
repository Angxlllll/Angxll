import crypto from 'crypto'
import webp from 'node-webpmux'

async function addExif(stickerBuffer, packname = '') {
  const img = new webp.Image()
  await img.load(stickerBuffer)

  const json = {
    'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': packname,
    'sticker-pack-publisher': '',
    emojis: ['🔥', '🗣️', '🥺']
  }

  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')

  const exif = Buffer.concat([
    Buffer.from([
      0x49, 0x49, 0x2A, 0x00,
      0x08, 0x00, 0x00, 0x00,
      0x01, 0x00,
      0x41, 0x57,
      0x07, 0x00,
      0x00, 0x00,
      0x00, 0x00,
      0x16, 0x00, 0x00, 0x00
    ]),
    jsonBuf
  ])

  exif.writeUIntLE(jsonBuf.length, 14, 4)
  img.exif = exif

  return img.save(null, {
    lossless: true,
    quality: 100
  })
}

let handler = async (m, { conn, args = [] }) => {
  try {
    await conn.sendMessage(m.chat, {
      react: { text: '🕒', key: m.key }
    })

    let q = m.quoted || m

    if (q.mtype !== 'stickerMessage') {
      return conn.sendMessage(
        m.chat,
        { text: '*𝖱𝖾𝗌𝗉𝗈𝗇𝖽𝖾 𝖺 𝗎𝗇 𝖲𝗍𝗂𝖼𝗄𝖾𝗋 𝗉𝖺𝗋𝖺 𝖼𝖺𝗆𝖻𝗂𝖺𝗋 𝖾𝗅 𝖶𝗆*' },
        { quoted: m }
      )
    }

    const text = args.join(' ').trim()
    const packname = String(
      text || m.pushName || 'Usuario'
    ).trim()

    if (!q.download) throw 'No se puede descargar el sticker'
    const media = await q.download()
    if (!Buffer.isBuffer(media)) throw 'Media inválida'

    let buffer
    try {
      buffer = await addExif(media, packname)
    } catch {
      return conn.sendMessage(
        m.chat,
        { text: '❌ Sticker incompatible' },
        { quoted: m }
      )
    }

    await conn.sendMessage(
      m.chat,
      { sticker: buffer },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, {
      react: { text: '✅', key: m.key }
    })

  } catch (e) {
    console.error(e)
    await conn.sendMessage(
      m.chat,
      { text: '*𝖮𝖼𝗎𝗋𝗋𝗂ó 𝗎𝗇 𝖾𝗋𝗋𝗈𝗋 𝖺𝗅 𝗉𝗋𝗈𝖼𝖾𝗌𝖺𝗋 𝖾𝗅 𝗌𝗍𝗂𝖼𝗄𝖾𝗋*' },
      { quoted: m }
    )
  }
}

handler.help = ['𝖶𝗆 <𝖳𝖾𝗑𝗍𝗈>']
handler.tags = ['𝖲𝖳𝖨𝖢𝖪𝖤𝖱𝖲']
handler.command = ['wm', 'robar', 'robarsticker']
export default handler