import * as baileys from '@whiskeysockets/baileys'

const {
  makeWASocket: _makeWASocket,
  getContentType,
  downloadContentFromMessage,
  jidNormalizedUser
} = baileys

export const delay = ms => new Promise(r => setTimeout(r, ms))

const DIGITS = s => String(s || '').replace(/\D/g, '')

const jidCache = new Map()
const JID_CACHE_LIMIT = 10000

export function decodeJid(jid) {
  if (!jid) return jid
  const cached = jidCache.get(jid)
  if (cached) return cached
  let v
  try {
    v = jidNormalizedUser(jid)
  } catch {
    v = jid
  }
  jidCache.set(jid, v)
  if (jidCache.size > JID_CACHE_LIMIT)
    jidCache.delete(jidCache.keys().next().value)
  return v
}

const typeCache = new Map()
const TYPE_CACHE_LIMIT = 50

function normalizeType(type) {
  if (!type || typeof type !== 'string') return null
  const cached = typeCache.get(type)
  if (cached) return cached
  const v = type
    .replace('viewOnceMessageV2Extension', '')
    .replace('viewOnceMessageV2', '')
    .replace('viewOnceMessage', '')
    .replace('Message', '')
  typeCache.set(type, v)
  if (typeCache.size > TYPE_CACHE_LIMIT)
    typeCache.delete(typeCache.keys().next().value)
  return v
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0)
  if (Buffer.isBuffer(stream)) return stream
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}

export async function smsg(conn, raw) {
  if (!raw || !raw.message) return raw

  const key = raw.key
  const msg = raw.message
  const mtype = getContentType(msg)
  if (!mtype) return raw

  const content = msg[mtype] || {}
  const userJid = decodeJid(conn.user?.id)

  const m = raw

  m.id = key.id
  m.chat = decodeJid(key.remoteJid)
  m.fromMe = !!key.fromMe
  m.isGroup = m.chat.endsWith('@g.us')

  m.sender = decodeJid(
    m.fromMe ? userJid : key.participant || m.chat
  )

  m.senderNum = DIGITS(m.sender)
  m.isBaileys = typeof key.id === 'string' && key.id.startsWith('BAE5')

  m.mtype = mtype
  m.msg = content

  const text =
    msg.conversation ||
    content.text ||
    content.caption ||
    ''

  m.text = text

  const normType =
    mtype !== 'conversation'
      ? normalizeType(mtype)
      : null

  if (normType)
    m.mediaType = normType

  const ctx = content.contextInfo

  if (ctx?.mentionedJid)
    m.mentionedJid = ctx.mentionedJid

  if (ctx?.quotedMessage) {
    const qm = ctx.quotedMessage
    const qtype = getContentType(qm)
    const qcontent = qm[qtype] || {}
    const quotedSender = decodeJid(ctx.participant || m.chat)

    const qNormType =
      qtype !== 'conversation'
        ? normalizeType(qtype)
        : null

    m.quoted = {
      key: {
        remoteJid: m.chat,
        fromMe: quotedSender === userJid,
        id: ctx.stanzaId,
        participant: quotedSender
      },
      message: qm,
      mtype: qtype,
      sender: quotedSender,
      text:
        qm.conversation ||
        qcontent.text ||
        qcontent.caption ||
        '',
      download: qNormType
        ? async () =>
            streamToBuffer(
              await downloadContentFromMessage(
                qcontent,
                qNormType
              )
            )
        : null
    }
  }

  m.reply = (text, chat = m.chat, opts = {}) =>
    conn.sendMessage(chat, { text, ...opts }, { quoted: m })

  if (normType) {
    m.download = async () =>
      streamToBuffer(
        await downloadContentFromMessage(
          content,
          normType
        )
      )
  }

  return m
}

export function createSocket(opts = {}) {
  const sock = _makeWASocket(opts)
  sock.decodeJid = decodeJid
  sock.smsg = m => smsg(sock, m)
  return sock
}