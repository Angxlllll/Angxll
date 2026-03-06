import { smsg, decodeJid } from "./lib/simple.js"

Error.stackTraceLimit = 0

const DIGITS = s => String(s || "").replace(/\D/g, "")
const GROUP_TTL = 60000
const MAX_GROUP_CACHE = 500
const PLUGIN_TIMEOUT = 8000
const MAX_QUEUE_PER_CHAT = 50

const adminCache = new Map()
const chatQueues = new Map()

const FAIL = {
  rowner: "Solo el owner",
  owner: "Solo el owner",
  admin: "Solo admins",
  botAdmin: "Necesito admin"
}

function getText(msg) {
  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    ""
  )
}

function fastParse(text) {
  if (!text || text.length < 2) return null
  const prefix = text[0]
  const body = text.slice(1).trim()
  if (!body) return null
  const space = body.indexOf(" ")
  const command = (space === -1 ? body : body.slice(0, space)).toLowerCase()
  const args = space === -1 ? [] : body.slice(space + 1).trim().split(/\s+/)
  return { command, args, prefix }
}

function schedule(chatId, job) {
  let data = chatQueues.get(chatId)
  if (!data) {
    data = { queue: [], running: false }
    chatQueues.set(chatId, data)
  }
  if (data.queue.length >= MAX_QUEUE_PER_CHAT) return
  data.queue.push(job)
  if (!data.running) processChat(chatId, data)
}

async function processChat(chatId, data) {
  data.running = true
  while (data.queue.length) {
    const job = data.queue.shift()
    try { await job() } catch {}
  }
  data.running = false
}

function touchAdminCache(chatId, data) {
  adminCache.delete(chatId)
  adminCache.set(chatId, data)
}

async function getGroupAdmins(conn, chatId) {
  const cached = adminCache.get(chatId)
  if (cached && Date.now() - cached.t < GROUP_TTL) {
    touchAdminCache(chatId, cached)
    return cached.v
  }

  const meta = await conn.groupMetadata(chatId)
  const participants = meta?.participants || []
  const admins = new Set()

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]
    if (p?.admin) admins.add(DIGITS(p.id || p.jid))
  }

  const data = { v: admins, t: Date.now() }
  adminCache.set(chatId, data)

  if (adminCache.size > MAX_GROUP_CACHE) {
    const oldest = adminCache.keys().next().value
    if (oldest) adminCache.delete(oldest)
  }

  return admins
}

function runWithTimeout(promise, ms) {
  let timeout
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error("Timeout")), ms)
  })
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout))
}

global.dfail = async (type, m, conn) => {
  const msg = FAIL[type]
  if (!msg) return
  await conn.sendMessage(m.chat,{ text: msg },{ quoted: m })
}

export async function handler(update) {
  const msgs = update?.messages
  if (!msgs) return

  for (let i = 0; i < msgs.length; i++) {
    const raw = msgs[i]
    if (!raw?.message) continue

    const jid = raw.key?.remoteJid
    if (!jid || jid === "status@broadcast") continue

    const text = getText(raw.message)
    const parsed = fastParse(text)
    if (!parsed) continue

    schedule(jid, () => process.call(this, raw, parsed))
  }
}

async function process(raw, parsed) {
  const data = global.PLUGIN_BY_COMMAND?.get(parsed.command)
  if (!data) return

  const { exec, plugin } = data
  const m = await smsg(this, raw)
  if (!m) return

  const isGroup = m.isGroup
  const senderNo = m.senderNum
  const isFromMe = m.fromMe

  const owners = global.owner || []
  let isROwner = false

  for (let i = 0; i < owners.length; i++) {
    const o = owners[i]
    if (DIGITS(Array.isArray(o) ? o[0] : o) === senderNo) {
      isROwner = true
      break
    }
  }

  const isOwner = isROwner
  let isAdmin = false
  let isBotAdmin = false

  if (isGroup && (plugin.admin || plugin.botAdmin)) {
    const admins = await getGroupAdmins(this, m.chat)
    isAdmin = isOwner || admins.has(senderNo)

    if (!global.botNumber) {
      const jid = decodeJid(this.user?.id || "")
      global.botNumber = DIGITS(jid)
    }

    isBotAdmin = isOwner || admins.has(global.botNumber)
  }

  if (plugin.rowner && !isROwner) return global.dfail("rowner", m, this)
  if (plugin.owner && !isOwner) return global.dfail("owner", m, this)
  if (plugin.admin && !isAdmin && !isFromMe) return global.dfail("admin", m, this)
  if (plugin.botAdmin && !isBotAdmin) return global.dfail("botAdmin", m, this)

  try {
    await runWithTimeout(
      exec.call(this, m, {
        conn: this,
        args: parsed.args,
        command: parsed.command,
        usedPrefix: parsed.prefix,
        isROwner,
        isOwner,
        isAdmin,
        isBotAdmin,
        getGroupMeta:
          plugin.needsMeta && isGroup
            ? async () => await this.groupMetadata(m.chat)
            : null
      }),
      PLUGIN_TIMEOUT
    )
  } catch {}
}