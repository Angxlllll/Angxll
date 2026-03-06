import { smsg, decodeJid } from "./lib/simple.js"

const DIGITS = s => String(s || "").replace(/\D/g, "")

const GROUP_TTL = 60000
const GROUP_META_TTL = 120000
const MAX_GROUP_CACHE = 500
const PLUGIN_TIMEOUT = 8000

const MAX_PLUGIN_CONCURRENCY = 5

let runningPlugins = 0
const pluginQueue = []

const adminCache = new Map()
const groupMetaCache = new Map()

function fastArgs(str) {
  const args = []
  let start = 0

  for (let i = 0; i <= str.length; i++) {
    if (i === str.length || str.charCodeAt(i) === 32) {
      if (i > start) {
        args.push(str.slice(start, i))
      }
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

export async function handler(update) {
  const msgs = update?.messages
  if (!msgs) return

  for (const raw of msgs) {
    if (!raw?.message) continue
    await process.call(this, raw)
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

  await runPlugin(() =>
    runWithTimeout(
      exec.call(this, m, {
        conn: this,
        args,
        command,
        usedPrefix: prefix
      }),
      PLUGIN_TIMEOUT
    )
  )
}