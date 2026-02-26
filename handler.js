import { smsg, decodeJid } from "./lib/simple.js"

Error.stackTraceLimit = 0

const DIGITS = s => String(s || "").replace(/\D/g, "")

const GROUP_TTL = 60000
const MAX_GROUP_CACHE = 500

const adminCache = new Map()
const chatQueues = new Map()
const processingChats = new Set()

function schedule(chatId, job) {
  if (!chatQueues.has(chatId)) {
    chatQueues.set(chatId, [])
  }

  chatQueues.get(chatId).push(job)

  if (!processingChats.has(chatId)) {
    processChat(chatId)
  }
}

async function processChat(chatId) {
  processingChats.add(chatId)

  const queue = chatQueues.get(chatId)

  while (queue && queue.length) {
    const job = queue.shift()
    try {
      await job()
    } catch {}
  }

  processingChats.delete(chatId)
  chatQueues.delete(chatId)
}

async function getGroupAdmins(conn, chatId) {
  const cached = adminCache.get(chatId)
  if (cached && Date.now() - cached.t < GROUP_TTL) {
    return cached.v
  }

  const meta = await conn.groupMetadata(chatId)
  const participants = Array.isArray(meta?.participants) ? meta.participants : []

  const admins = new Set()
  for (const p of participants) {
    if (p?.admin) {
      admins.add(DIGITS(p.id || p.jid))
    }
  }

  if (adminCache.size > MAX_GROUP_CACHE) {
    adminCache.clear()
  }

  adminCache.set(chatId, { v: admins, t: Date.now() })

  return admins
}

const FAIL = {
  rowner: "Solo el owner",
  owner: "Solo el owner",
  admin: "Solo admins",
  botAdmin: "Necesito admin"
}

global.dfail = async (t, m, conn) => {
  if (!FAIL[t]) return
  await conn.sendMessage(
    m.chat,
    { text: FAIL[t], ...(await global.rcanal(conn, m)) },
    { quoted: m }
  )
}

export async function handler(update) {
  const msgs = update?.messages
  if (!msgs) return

  for (const raw of msgs) {
    if (!raw?.message) continue
    if (raw.key?.remoteJid === "status@broadcast") continue

    const msg =
      raw.message?.conversation ||
      raw.message?.extendedTextMessage?.text

    if (!msg) continue

    const c = msg.charCodeAt(0)
    if (c !== 46 && c !== 33) continue

    schedule(raw.key.remoteJid, () => process.call(this, raw))
  }
}

async function process(raw) {
  const m = await smsg(this, raw)
  if (!m || m.isBaileys || !m.text) return

  const body = m.text.slice(1).trim()
  if (!body) return

  const [cmd, ...args] = body.split(/\s+/)
  const command = cmd.toLowerCase()

  const plugin = global.COMMAND_MAP?.get(command)
  if (!plugin || plugin.disabled) return

  const isGroup = m.isGroup
  const senderNo = m.senderNum
  const isFromMe = m.fromMe

  const owners = global.owner || []

  const isROwner =
    Array.isArray(owners) &&
    owners.some(o => DIGITS(Array.isArray(o) ? o[0] : o) === senderNo)

  const isOwner = isROwner

  let isAdmin = false
  let isBotAdmin = false
  let groupAdmins = null

  if (isGroup) {
    groupAdmins = await getGroupAdmins(this, m.chat)

    isAdmin = isOwner || groupAdmins.has(senderNo)

    if (!global.botNumber) {
      const jid = decodeJid(this.user?.id || "")
      global.botNumber = DIGITS(jid)
    }

    isBotAdmin = isOwner || groupAdmins.has(global.botNumber)
  }

  if (plugin.rowner && !isROwner)
    return global.dfail("rowner", m, this)

  if (plugin.owner && !isOwner)
    return global.dfail("owner", m, this)

  if (plugin.admin && !isAdmin && !isFromMe)
    return global.dfail("admin", m, this)

  if (plugin.botAdmin && !isBotAdmin)
    return global.dfail("botAdmin", m, this)

  const exec = plugin.exec || plugin.default || plugin
  if (!exec) return

  await exec.call(this, m, {
    conn: this,
    args,
    command,
    usedPrefix: m.text[0],
    isROwner,
    isOwner,
    isAdmin,
    isBotAdmin,
    getGroupMeta: plugin.needsMeta && isGroup
      ? async () => await this.groupMetadata(m.chat)
      : null
  })
}