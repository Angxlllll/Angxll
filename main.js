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

global.plugins = Object.create(null)
global.PLUGIN_BY_COMMAND = new Map()
global.ALL_PLUGINS = []

const SESSION_DIR = global.sessions || "./Sessions/Owner"

try {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
} catch {}

const msgRetryCounterCache = new NodeCache({ stdTTL: 30, checkperiod: 60 })
const userDevicesCache = new NodeCache({ stdTTL: 120, checkperiod: 120 })

const DIGITS = s => String(s).replace(/\D/g, "")

function normalizePhone(input) {
  let s = DIGITS(input)
  if (!s) return ""
  if (s.startsWith("0")) s = s.replace(/^0+/, "")
  if (s.startsWith("52") && !s.startsWith("521") && s.length >= 12)
    s = "521" + s.slice(2)
  if (s.startsWith("54") && !s.startsWith("549") && s.length >= 11)
    s = "549" + s.slice(2)
  return s
}

let option = ""
let phoneNumber = ""

const methodCodeQR = process.argv.includes("--qr")
const methodCode = process.argv.includes("--code")

if (methodCodeQR) option = "1"
else if (methodCode) option = "2"
else if (!fs.existsSync(`${SESSION_DIR}/creds.json`)) {
  option = readlineSync.question(
    chalk.bold.white("\nSeleccione una opción:\n") +
      chalk.blueBright("1. Código QR\n") +
      chalk.cyan("2. Código de texto\n--> ")
  )

  while (!/^[12]$/.test(option)) {
    option = readlineSync.question("--> ")
  }

  if (option === "2") {
    const phoneInput = readlineSync.question(
      chalk.cyanBright("\nIngresa tu número con código país:\n--> ")
    )
    phoneNumber = normalizePhone(phoneInput)
  }
}

function rebuildPluginIndex() {
  global.PLUGIN_BY_COMMAND.clear()
  global.ALL_PLUGINS = []

  for (const plugin of Object.values(global.plugins)) {
    if (!plugin || plugin.disabled) continue

    global.ALL_PLUGINS.push(plugin)

    let cmds = plugin.command
    if (!cmds) continue
    if (!Array.isArray(cmds)) cmds = [cmds]

    for (const cmd of cmds) {
      global.PLUGIN_BY_COMMAND.set(cmd.toLowerCase(), plugin)
    }
  }
}

async function loadPlugins(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) {
      await loadPlugins(full)
    } else if (f.endsWith(".js")) {
      const m = await import(full + "?update=" + Date.now())
      global.plugins[full] = m.default || m
    }
  }
  rebuildPluginIndex()
}

const handler = await import("./handler.js")

let currentSock = null
let isStarting = false

async function startSock() {
  if (isStarting) return
  isStarting = true

  if (currentSock) {
    try {
      currentSock.ev.removeAllListeners()
      currentSock.ws.close()
    } catch {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()
  const logger = pino({ level: "silent" })

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    browser: Browsers.macOS("Chrome"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    msgRetryCounterCache,
    userDevicesCache,
    keepAliveIntervalMs: 20000,
    defaultQueryTimeoutMs: 60000,
    getMessage: async () => ""
  })

  currentSock = sock
  global.conn = sock
  store.bind(sock)

  sock.ev.on("creds.update", saveCreds)

  if (option === "2" && !fs.existsSync(`${SESSION_DIR}/creds.json`)) {
    setTimeout(async () => {
      if (!state.creds.registered) {
        const pairing = await sock.requestPairingCode(phoneNumber)
        const code = pairing?.match(/.{1,4}/g)?.join("-") || pairing
        console.log("\nCódigo de emparejamiento:\n")
        console.log(code)
      }
    }, 3000)
  }

  const messageQueue = []
  let processing = false

  async function processQueue() {
    if (processing) return
    processing = true

    while (messageQueue.length) {
      const job = messageQueue.shift()
      try {
        await handler.handler.call(sock, job)
      } catch {}
    }

    processing = false
  }

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return
    if (!messages?.length) return

    const m = messages[0]
    if (!m?.message) return
    if (m.key?.remoteJid === "status@broadcast") return

    messageQueue.push({ messages: [m] })
    processQueue()
  })

  sock.ev.on("connection.update", async update => {
    const { qr, connection, lastDisconnect } = update
    const reason = lastDisconnect?.error?.output?.statusCode

    if (qr && option === "1") {
      console.log("\nEscanea el código QR:\n")
      qrcode.generate(qr, { small: true })
    }

    if (connection === "open") {
      console.log(chalk.greenBright("✿ Conectado"))
      isStarting = false
    }

    if (connection === "close") {
      if (reason === DisconnectReason.loggedOut) {
        process.exit(0)
      } else {
        isStarting = false
        setTimeout(() => startSock(), 3000)
      }
    }
  })
}

await loadPlugins(path.join(__dirname, "plugins"))
await startSock()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)