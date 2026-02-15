import { smsg, decodeJid } from "./lib/simple.js"

Error.stackTraceLimit = 0

const DIGITS = s => String(s || "").replace(/\D/g, "")

const GROUP_TTL = 60000
const MAX_GROUP_CACHE = 500
const MAX_CONCURRENT = 5

const groupCache = new Map()

let activeProcesses = 0
const queue = []

function runNext() {
  if (queue.length === 0 || activeProcesses >= MAX_CONCURRENT) return
  activeProcesses++
  const job = queue.shift()
  job().finally(() => {
    activeProcesses--
    runNext()
  })
}

function enqueue(fn) {
  return new Promise((resolve) => {
    queue.push(() => fn().then(resolve))
    runNext()
  })
}

async function getGroupMeta(conn, chatId) {
  const cached = groupCache.get(chatId)

  if (cached && (Date.now() - cached.t < GROUP_TTL)) {
    return cached.v
  }

  const meta = await conn.groupMetadata(chatId)

  const admins = new Set()
  const participants = Array.isArray(meta?.participants)
    ? meta.participants
    : []

  for (const p of participants) {
    if (p?.admin === "admin" || p?.admin === "superadmin") {
      admins.add(DIGITS(p.id || p.jid))
    }
  }

  const value = { meta, admins }

  if (groupCache.size > MAX_GROUP_CACHE) {
    groupCache.clear()
  }

  groupCache.set(chatId, { v: value, t: Date.now() })

  return value
}

const FAIL = {
  rowner: "Solo el owner",
  owner: "Solo el owner",
  admin: "Solo admins",
  botAdmin: "Necesito admin"
}

global.dfail = async (t, m, conn) => {
  if (!FAIL[t]) return

  conn.sendMessage(
    m.chat,
    {
      text: FAIL[t],
      ...(await global.rcanal(conn, m))
    },
    { quoted: m }
  )
}

export async function handler(update) {
  const msgs = update?.messages
  if (!msgs) return

  await Promise.all(
    msgs.map(raw => enqueue(() => process.call(this, raw)))
  )
}

async function process(raw) {
  if (!raw?.message) return
  if (raw.key?.remoteJid === "status@broadcast") return

  const m = await smsg(this, raw)
  if (!m || m.isBaileys || !m.text) return

  const prefix = m.text[0]
  if (prefix !== "." && prefix !== "!") return

  const body = m.text.slice(1).trim()
  if (!body) return

  const [cmd, ...args] = body.split(/\s+/)
  const command = cmd.toLowerCase()

  const plugin = global.COMMAND_MAP?.get(command)
  if (!plugin || plugin.disabled) return

const chatId = m.chat
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
  let groupData = null

  if (isGroup) {
    groupData = await getGroupMeta(this, chatId)

    isAdmin =
      isOwner ||
      groupData.admins.has(senderNo)

    const botJid = decodeJid(this.user?.id || "")
    const botNo = DIGITS(botJid)

    isBotAdmin =
      isOwner ||
      groupData.admins.has(botNo)
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

  try {
    await exec.call(this, m, {
      conn: this,
      args,
      command,
      usedPrefix: prefix,
      isROwner,
      isOwner,
      isAdmin,
      isBotAdmin,
      getGroupMeta: isGroup
        ? async () => groupData.meta
        : null
    })
  } catch (e) {
    console.error("Plugin error:", e)
  }
}