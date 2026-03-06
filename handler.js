import { smsg, decodeJid } from "./lib/simple.js"

Error.stackTraceLimit = 0

const DIGITS = s => String(s || "").replace(/\D/g, "")

const GROUP_TTL = 60000
const GROUP_META_TTL = 120000
const MAX_GROUP_CACHE = 500
const PLUGIN_TIMEOUT = 8000

const MAX_PLUGIN_CONCURRENCY = 5
const MAX_QUEUE_PER_CHAT = 50

let runningPlugins = 0
const pluginQueue = []

const adminCache = new Map()
const groupMetaCache = new Map()
const chatQueues = new Map()

function fastArgs(str) {
  const args = []
  let start = 0

  for (let i = 0; i <= str.length; i++) {
    if (i === str.length || str.charCodeAt(i) === 32) {
      if (i > start) args.push(str.slice(start, i))
      start = i + 1
    }
  }

  return args
}

function runWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    )
  ])
}

async function runPlugin(fn) {
  if (runningPlugins >= MAX_PLUGIN_CONCURRENCY) {
    await new Promise(resolve => pluginQueue.push(resolve))
  }

  runningPlugins++

  try {
    return await fn()
  } finally {
    runningPlugins--

    const next = pluginQueue.shift()
    if (next) next()
  }
}

function schedule(chatId, job) {
  if (!chatId) return

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
    try {
      await job()
    } catch {}
  }

  data.running = false
}

async function getGroupMetadata(conn, jid) {
  const cached = groupMetaCache.get(jid)

  if (cached && Date.now() - cached.t < GROUP_META_TTL) {
    return cached.v
  }

  const meta = await conn.groupMetadata(jid)

  groupMetaCache.set(jid, {
    v: meta,
    t: Date.now()
  })

  return meta
}

async function getGroupAdmins(conn, chatId) {
  const cached = adminCache.get(chatId)

  if (cached && Date.now() - cached.t < GROUP_TTL) {
    return cached.v
  }

  const meta = await getGroupMetadata(conn, chatId)
  const participants = meta?.participants || []

  const admins = new Set()

  for (const p of participants) {
    if (p.admin) {
      admins.add(DIGITS(p.id || p.jid))
    }
  }

  adminCache.set(chatId, {
    v: admins,
    t: Date.now()
  })

  if (adminCache.size > MAX_GROUP_CACHE) {
    adminCache.delete(adminCache.keys().next().value)
  }

  return admins
}

const FAIL = {
  rowner: "Solo el owner",
  owner: "Solo el owner",
  admin: "Solo admins",
  botAdmin: "Necesito ser admin"
}

global.dfail = async (type, m, conn) => {
  const msg = FAIL[type]
  if (!msg) return

  await conn.sendMessage(
    m.chat,
    { text: msg },
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

  const first = text.charCodeAt(0)
  if (!global.PREFIX_SET.has(first)) return

  const prefix = text[0]
  const spaceIndex = text.indexOf(" ")

  let command
  let args

  if (spaceIndex === -1) {
    command = text.slice(1).toLowerCase()
    args = []
  } else {
    command = text.slice(1, spaceIndex).toLowerCase()
    args = fastArgs(text.slice(spaceIndex + 1))
  }

  const plugin = global.COMMAND_ROUTER?.[command]
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

  await runPlugin(() =>
    runWithTimeout(
      exec.call(this, m, {
        conn: this,
        args,
        command,
        usedPrefix: prefix,
        isROwner,
        isOwner,
        isAdmin,
        isBotAdmin
      }),
      PLUGIN_TIMEOUT
    )
  )
}