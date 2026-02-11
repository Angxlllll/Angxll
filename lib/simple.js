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
  try { v = jidNormalizedUser(jid) } catch { v = jid }
  jidCache.set(jid, v)
  if (jidCache.size > JID_CACHE_LIMIT)
    jidCache.delete(jidCache.keys().next().value)
  return v
}

const typeCache = Object.create(null)

function normalizeType(type) {
  if (!type || typeof type !== 'string') return null
  let v = typeCache[type]
  if (v) return v
  v = type
    .replace('viewOnceMessageV2Extension', '')
    .replace('viewOnceMessageV2', '')
    .replace('viewOnceMessage', '')
    .replace('Message', '')
  typeCache[type] = v
  return v
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0)
  if (Buffer.isBuffer(stream)) return stream
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}

const groupMetaCache = new Map()
const adminCache = new Map()
const GROUP_TTL = 30_000

function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === 'string' && v.id.endsWith('@lid') && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }))
  } catch {
    return participants || []
  }
}

async function getGroupMeta(conn, jid) {
  const cached = groupMetaCache.get(jid)
  if (cached && Date.now() - cached.time < GROUP_TTL)
    return cached.data

  const data = await conn.groupMetadata(jid)
  groupMetaCache.set(jid, { data, time: Date.now() })
  return data
}

async function getAdminData(conn, chat) {
  const cached = adminCache.get(chat)
  if (cached && Date.now() - cached.time < GROUP_TTL)
    return cached

  const meta = await getGroupMeta(conn, chat)
  const raw = meta.participants || []
  const norm = lidParser(raw)

  const admins = new Set()
  let botAdmin = false
  const botJid = decodeJid(conn.user?.id || '')

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const n = norm[i]
    const isAdm =
      r?.admin === 'admin' ||
      r?.admin === 'superadmin' ||
      n?.admin === 'admin' ||
      n?.admin === 'superadmin'

    if (!isAdm) continue

    const ids = [r?.id, r?.jid, n?.id]
    for (const id of ids) {
      const num = DIGITS(id)
      if (num) admins.add(num)
      if (decodeJid(id) === botJid) botAdmin = true
    }
  }

  const data = { admins, botAdmin, time: Date.now() }
  adminCache.set(chat, data)
  return data
}

export async function smsg(conn, m) {
  if (!m || !m.message) return m

  const key = m.key
  const msg = m.message
  const mtype = getContentType(msg)
  const content = msg[mtype] || {}
  const userJid = decodeJid(conn.user?.id)

  m.id = key.id
  m.chat = decodeJid(key.remoteJid)
  m.fromMe = !!key.fromMe
  m.isGroup = m.chat.endsWith('@g.us')

  m.sender = decodeJid(
    m.fromMe ? userJid : key.participant || m.chat
  )

  m.senderNum = DIGITS(m.sender)

  m.isBaileys =
    typeof key.id === 'string' &&
    key.id.length === 16 &&
    key.id.startsWith('BAE5')

  m.mtype = mtype
  m.msg = content

  const text =
    content.text ??
    content.caption ??
    msg.conversation ??
    content?.extendedTextMessage?.text ??
    ''

  m.text = text
  m.body = text

  const normType =
    mtype !== 'conversation' ? normalizeType(mtype) : null

  if (normType) m.mediaType = normType

  const ctx = content.contextInfo

  if (ctx?.mentionedJid)
    m.mentionedJid = ctx.mentionedJid

  if (ctx?.quotedMessage) {
    const qm = ctx.quotedMessage
    const qtype = getContentType(qm)
    const qcontent = qm[qtype] || {}
    const quotedSender = decodeJid(ctx.participant)
    const qNormType =
      qtype !== 'conversation' ? normalizeType(qtype) : null

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
        qcontent.text ??
        qcontent.caption ??
        qcontent?.extendedTextMessage?.text ??
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

  const owners = global.owner || []
  m.isROwner =
    Array.isArray(owners) &&
    owners.some(o => DIGITS(Array.isArray(o) ? o[0] : o) === m.senderNum)

  m.isOwner = m.isROwner
  m.isAdmin = false
  m.isBotAdmin = false

  if (m.isGroup) {
    const { admins, botAdmin } = await getAdminData(conn, m.chat)
    m.isAdmin = m.isOwner || admins.has(m.senderNum)
    m.isBotAdmin = m.isOwner || botAdmin
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

export function all(m) {
  const type = m.mtype
  if (type !== 'buttonsResponseMessage' && type !== 'listResponseMessage')
    return

  let selection

  if (type === 'buttonsResponseMessage') {
    selection = m.message?.buttonsResponseMessage?.selectedButtonId
  } else {
    selection =
      m.message?.listResponseMessage?.singleSelectReply?.selectedRowId
  }

  if (!selection) return

  m.text = selection
  m.body = selection

  const msg = m.message

  if (!msg.conversation)
    msg.conversation = selection

  const ext =
    msg.extendedTextMessage ||
    (msg.extendedTextMessage = {})

  ext.text = selection

  if (msg.buttonsResponseMessage)
    delete msg.buttonsResponseMessage

  if (msg.listResponseMessage)
    delete msg.listResponseMessage
}