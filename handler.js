import { smsg, decodeJid } from "./lib/simple.js"

Error.stackTraceLimit = 0

const DIGITS = s => String(s || "").replace(/\D/g, "")

const GROUP_TTL = 60000
const MAX_GROUP_CACHE = 500
const PLUGIN_TIMEOUT = 8000
const MAX_QUEUE_PER_CHAT = 50

const adminCache = new Map()
const chatQueues = new Map()

function schedule(chatId, job) {
  if (!chatId) return

  let data = chatQueues.get(chatId)

  if (!data) {
    data = {
      queue: [],
      running: false
    }
    chatQueues.set(chatId, data)
  }

  if (data.queue.length >= MAX_QUEUE_PER_CHAT) return

  data.queue.push(job)

  if (!data.running) {
    processChat(chatId, data)
  }
}

async function processChat(chatId, data) {
  data.running = true

  while (data.queue.length) {
    const job = data.queue.shift()
    try {
      await job()
    } catch {}
  }

  data.running = false
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

  adminCache.set(chatId, { v: admins, t: Date.now() })

  if (adminCache.size > MAX_GROUP_CACHE) {
    const oldestKey = adminCache.keys().next().value
    if (oldestKey) adminCache.delete(oldestKey)
  }

  return admins
}

function runWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    )
  ])
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
    if (!raw.key?.remoteJid) continue
    if (raw.key.remoteJid === "status@broadcast") continue

    schedule(raw.key.remoteJid, () => process.call(this, raw))
  }
}

async function process(raw) {
  const m = await smsg(this, raw)
  if (!m || m.isBaileys || !m.text) return

  const text = m.text
  if (text.length < 2) return

  const body = text.slice(1).trim()
  if (!body) return

  const spaceIndex = body.indexOf(" ")
  const command = (spaceIndex === -1 ? body : body.slice(0, spaceIndex)).toLowerCase()
  const args = spaceIndex === -1 ? [] : body.slice(spaceIndex + 1).split(/\s+/)

  const plugin = global.PLUGIN_BY_COMMAND?.get(command)
  if (!plugin || plugin.disabled) return

  const exec = plugin.exec || plugin.default || plugin
  if (!exec) return

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

  if (isGroup && (plugin.admin || plugin.botAdmin)) {
    const groupAdmins = await getGroupAdmins(this, m.chat)

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

  await runWithTimeout(
    exec.call(this, m, {
      conn: this,
      args,
      command,
      usedPrefix: text[0],
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
}