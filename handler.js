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

    data = { queue: [], running: false }

    chatQueues.set(chatId, data)

  }

  if (data.queue.length >= MAX_QUEUE_PER_CHAT) return

  data.queue.push(job)

  if (!data.running)
    processChat(chatId, data)

}

async function processChat(chatId, data) {

  data.running = true

  while (data.queue.length) {

    const job = data.queue.shift()

    try { await job() } catch {}

  }

  data.running = false

}

async function getGroupAdmins(conn, chatId) {

  const cached = adminCache.get(chatId)

  if (cached && Date.now() - cached.t < GROUP_TTL)
    return cached.v

  const meta = await conn.groupMetadata(chatId)

  const participants = Array.isArray(meta?.participants)
    ? meta.participants
    : []

  const admins = new Set()

  for (const p of participants) {

    if (p?.admin)
      admins.add(DIGITS(p.id || p.jid))

  }

  adminCache.set(chatId, { v: admins, t: Date.now() })

  if (adminCache.size > MAX_GROUP_CACHE) {

    const oldest = adminCache.keys().next().value

    if (oldest) adminCache.delete(oldest)

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

export default async function handler(conn, m, loadPlugin) {

  try {

    m = smsg(conn, m)

    const text = m.text
    if (!text) return

    const body = text.slice(1)

    let i = body.indexOf(" ")

    let command
    let args = []

    if (i === -1)
      command = body.toLowerCase()
    else
      command = body.slice(0, i).toLowerCase()

    const exec = await loadPlugin(command)

    if (!exec) return

    if (i !== -1)
      args = body.slice(i + 1).trim().split(/\s+/)

    schedule(m.chat, async () => {

      const isGroup = m.isGroup

      const sender = DIGITS(m.sender)

      const botNumber = DIGITS(conn.user.id)

      const owners = (global.owner || []).map(o =>
        DIGITS(Array.isArray(o) ? o[0] : o)
      )

      const isOwner = owners.includes(sender)
      const isROwner = isOwner

      let isAdmin = false
      let isBotAdmin = false

      if (isGroup) {

        const admins = await getGroupAdmins(conn, m.chat)

        isAdmin = admins.has(sender)
        isBotAdmin = admins.has(botNumber)

      }

      const plugin = exec.plugin || {}

      if (plugin.rowner && !isROwner)
        return global.dfail?.("rowner", m, conn)

      if (plugin.owner && !isOwner)
        return global.dfail?.("owner", m, conn)

      if (plugin.admin && !isAdmin)
        return global.dfail?.("admin", m, conn)

      if (plugin.botAdmin && !isBotAdmin)
        return global.dfail?.("botAdmin", m, conn)

      const ctx = {
        conn,
        m,
        args,
        command,
        isOwner,
        isROwner,
        isAdmin,
        isBotAdmin
      }

      await runWithTimeout(
        exec(ctx),
        PLUGIN_TIMEOUT
      )

    })

  } catch {}

}