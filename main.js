import "./lib/before.js"
import "./config.js"

import fs from "fs"
import path from "path"
import readlineSync from "readline-sync"
import chalk from "chalk"
import pino from "pino"
import NodeCache from "node-cache"
import { fileURLToPath } from "url"
import qrcode from "qrcode-terminal"

import store from "./lib/store.js"

import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.PLUGIN_PATH = new Map()
global.PLUGIN_CACHE = new Map()
global.PLUGIN_EXEC = new Map()

const SESSION_DIR = global.sessions || "./Sessions/Owner"

fs.mkdirSync(SESSION_DIR, { recursive: true })

const msgRetryCounterCache = new NodeCache({ stdTTL: 30 })
const userDevicesCache = new NodeCache({ stdTTL: 120 })

const PREFIX = new Uint8Array(128)

PREFIX[".".charCodeAt(0)] = 1
PREFIX["!".charCodeAt(0)] = 1
PREFIX["#".charCodeAt(0)] = 1
PREFIX["/".charCodeAt(0)] = 1
PREFIX["$".charCodeAt(0)] = 1

const DIGITS = s => String(s || "").replace(/\D/g, "")

function normalizePhone(input) {

  let s = DIGITS(input)

  if (!s) return ""

  if (s.startsWith("0"))
    s = s.replace(/^0+/, "")

  if (s.startsWith("52") && !s.startsWith("521") && s.length >= 12)
    s = "521" + s.slice(2)

  if (s.startsWith("54") && !s.startsWith("549") && s.length >= 11)
    s = "549" + s.slice(2)

  return s
}

let option = ""
let phoneNumber = ""

if (!fs.existsSync(`${SESSION_DIR}/creds.json`)) {

  option = readlineSync.question("\n1 QR\n2 Codigo\n--> ")

  if (option === "2") {

    const phoneInput = readlineSync.question(
      "\nNumero con prefijo pais:\n--> "
    )

    phoneNumber = normalizePhone(phoneInput)

  }

}

async function indexPlugins(dir) {

  const files = await fs.promises.readdir(dir)

  for (const f of files) {

    const full = path.join(dir, f)

    const stat = await fs.promises.stat(full)

    if (stat.isDirectory()) {
      await indexPlugins(full)
      continue
    }

    if (!f.endsWith(".js")) continue

    const m = await import(full)

    const plugin = m.default || m

    let cmds = plugin.command

    if (!cmds) continue

    if (!Array.isArray(cmds))
      cmds = [cmds]

    for (const cmd of cmds)
      global.PLUGIN_PATH.set(cmd.toLowerCase(), full)

  }

}

async function loadPlugin(cmd) {

  if (global.PLUGIN_EXEC.has(cmd))
    return global.PLUGIN_EXEC.get(cmd)

  const file = global.PLUGIN_PATH.get(cmd)

  if (!file) return null

  let plugin = global.PLUGIN_CACHE.get(file)

  if (!plugin) {

    const m = await import(file + "?update=" + Date.now())

    plugin = m.default || m

    global.PLUGIN_CACHE.set(file, plugin)

  }

  const exec = plugin.run
    ? ctx => plugin.run(ctx)
    : ctx => plugin(ctx.conn, ctx.m, ctx)

  exec.plugin = plugin

  global.PLUGIN_EXEC.set(cmd, exec)

  return exec
}

const handler = await import("./handler.js")

let sock

async function startSock() {

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({

    version,

    logger: pino({ level: "silent" }),

    printQRInTerminal: option === "1",

    browser: Browsers.macOS("Chrome"),

    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino())
    },

    msgRetryCounterCache,
    userDevicesCache,

    keepAliveIntervalMs: 20000,

    getMessage: async () => {
      return { conversation: "" }
    }

  })

  global.conn = sock

  store.bind(sock)

  sock.ev.on("creds.update", saveCreds)

  if (option === "2") {

    setTimeout(async () => {

      const pairing = await sock.requestPairingCode(phoneNumber)

      console.log("\nCodigo:\n", pairing)

    }, 3000)

  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {

    if (qr && option === "1")
      qrcode.generate(qr, { small: true })

    if (connection === "close") {

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      console.log(chalk.red("Conexion cerrada"))

      if (shouldReconnect)
        startSock()

    }

    if (connection === "open")
      console.log(chalk.green("Bot conectado"))

  })

  sock.ev.on("messages.upsert", async update => {

    if (update.type !== "notify") return

    const msgs = update.messages

    for (const m of msgs) {

      const msg = m.message
      if (!msg) continue

      const text =
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.listResponseMessage?.singleSelectReply?.selectedRowId

      if (!text) continue

      const first = text.charCodeAt(0)

      if (!PREFIX[first]) continue

      handler.default(sock, m, loadPlugin)

    }

  })

}

await indexPlugins(path.join(__dirname, "plugins"))

await startSock()