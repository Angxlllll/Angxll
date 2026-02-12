import { smsg, decodeJid, all } from "./lib/simple.js"

Error.stackTraceLimit = 0

const DIGITS = s => String(s || "").replace(/\D/g, "")

function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }))
  } catch {
    return participants || []
  }
}

const groupCache = new Map()

async function getGroupMeta(conn, chatId) {
  const cached = groupCache.get(chatId)
  if (cached && (Date.now() - cached.t < 60000)) {
    return cached.v
  }
  const meta = await conn.groupMetadata(chatId)
  groupCache.set(chatId, { v: meta, t: Date.now() })
  return meta
}

async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await getGroupMeta(conn, chatId)
    const raw = Array.isArray(meta?.participants) ? meta.participants : []
    const norm = lidParser(raw)

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i]
      const n = norm[i]
      const isAdm =
        r?.admin === "admin" ||
        r?.admin === "superadmin" ||
        n?.admin === "admin" ||
        n?.admin === "superadmin"

      if (!isAdm) continue

      const ids = [r?.id, r?.jid, n?.id]
      if (ids.some(x => DIGITS(x) === number)) return true
    }
    return false
  } catch {
    return false
  }
}

async function isBotAdminReal(conn, chatId) {
  try {
    const meta = await getGroupMeta(conn, chatId)
    const raw = Array.isArray(meta?.participants) ? meta.participants : []
    const botJid = decodeJid(conn.user?.id || "")
    const norm = lidParser(raw)

    const idx = norm.findIndex(p => p?.id === botJid)
    if (idx < 0) return false

    const r = raw[idx]
    const n = norm[idx]

    return (
      r?.admin === "admin" ||
      r?.admin === "superadmin" ||
      n?.admin === "admin" ||
      n?.admin === "superadmin"
    )
  } catch {
    return false
  }
}

const FAIL = {
  rowner: "Solo el owner",
  owner: "Solo el owner",
  admin: "Solo admins",
  botAdmin: "Necesito admin"
}

global.dfail = (t, m, c) =>
  FAIL[t] && c.sendMessage(m.chat, { text: FAIL[t] }, { quoted: m })

export async function handler(update) {
  const msgs = update?.messages
  if (!msgs) return

  for (const raw of msgs) {
    if (!raw.message) continue
    if (raw.key?.remoteJid === "status@broadcast") continue
    await process.call(this, raw)
  }
}

async function process(raw) {
  const m = await smsg(this, raw)
  if (!m || m.isBaileys) return

  all(m)

  if (!m.text) return

  const prefix = m.text[0]
  if (prefix !== "." && prefix !== "!") return

  const body = m.text.slice(1).trim()
  if (!body) return

  const [cmd, ...args] = body.split(/\s+/)
  const command = cmd.toLowerCase()

  const plugin = global.COMMAND_MAP.get(command)
  if (!plugin || plugin.disabled) return

  const chatId = m.chat
  const isGroup = chatId.endsWith("@g.us")
  const senderJid = m.key?.participant || m.sender
  const senderNo = DIGITS(senderJid)
  const isFromMe = !!m.key?.fromMe

  const owners = global.owner || []

  const isROwner =
    Array.isArray(owners) &&
    owners.some(o => DIGITS(Array.isArray(o) ? o[0] : o) === senderNo)

  const isOwner = isROwner

  let isAdmin = false
  let isBotAdmin = false

  if (isGroup) {
    isAdmin = isOwner || await isAdminByNumber(this, chatId, senderNo)
    isBotAdmin = isOwner || await isBotAdminReal(this, chatId)
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
      isBotAdmin
    })
  } catch (e) {
    console.error("Plugin error:", e)
  }
}