import { smsg, all } from "./lib/simple.js"

Error.stackTraceLimit = 0

const FAIL = {
  rowner: "Solo el owner",
  owner: "Solo el owner",
  admin: "Solo admins",
  botAdmin: "Necesito admin"
}

global.dfail = (type, m, conn) =>
  FAIL[type] &&
  conn.sendMessage(
    m.chat,
    { text: FAIL[type] },
    { quoted: m }
  )

export async function handler(update) {
  const messages = update?.messages
  if (!messages || !Array.isArray(messages)) return

  for (const raw of messages) {
    if (!raw?.message) continue
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

  const parts = body.split(/\s+/)
  const command = parts.shift().toLowerCase()
  const args = parts

  const plugin = global.COMMAND_MAP.get(command)
  if (!plugin || plugin.disabled) return

  if (plugin.rowner && !m.isROwner)
    return global.dfail("rowner", m, this)

  if (plugin.owner && !m.isOwner)
    return global.dfail("owner", m, this)

  if (plugin.admin && !m.isAdmin && !m.fromMe)
    return global.dfail("admin", m, this)

  if (plugin.botAdmin && !m.isBotAdmin)
    return global.dfail("botAdmin", m, this)

  const exec = plugin.exec || plugin.default || plugin
  if (!exec) return

  await exec.call(this, m, {
    conn: this,
    args,
    command,
    usedPrefix: prefix,
    isROwner: m.isROwner,
    isOwner: m.isOwner,
    isAdmin: m.isAdmin,
    isBotAdmin: m.isBotAdmin
  })
}