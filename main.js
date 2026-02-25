import "./lib/before.js"
import "./config.js"

import fs from "fs"
import path from "path"
import readline from "readline"
import readlineSync from "readline-sync"
import chalk from "chalk"
import pino from "pino"
import NodeCache from "node-cache"
import { fileURLToPath } from "url"

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
global.COMMAND_MAP = new Map()

const SESSION_DIR = global.sessions || "./Sessions/Owner"

try {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
} catch {}

const msgRetryCounterCache = new NodeCache({ stdTTL: 30 })
const userDevicesCache = new NodeCache({ stdTTL: 120 })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = q => new Promise(r => rl.question(q, r))

const methodCodeQR = process.argv.includes("--qr")
const methodCode = process.argv.includes("--code")

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

const pluginRoot = path.join(__dirname, "plugins")

function rebuildPluginIndex() {
  global.COMMAND_MAP.clear()
  for (const plugin of Object.values(global.plugins)) {
    if (!plugin || plugin.disabled) continue
    let cmds = plugin.command
    if (!cmds) continue
    if (!Array.isArray(cmds)) cmds = [cmds]
    for (const c of cmds) {
      global.COMMAND_MAP.set(c.toLowerCase(), plugin)
    }
  }
}

async function loadPlugins(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) {
      await loadPlugins(full)
    } else if (f.endsWith(".js")) {
      const m = await import(full)
      global.plugins[full] = m.default || m
    }
  }
  rebuildPluginIndex()
}

const handler = await import("./handler.js")

async function startSock() {
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
    markOnlineOnConnect: false,
    emitOwnEvents: false,
    generateHighQualityLinkPreview: false,
    msgRetryCounterCache,
    userDevicesCache,
    keepAliveIntervalMs: 45000,
    getMessage: async () => ""
  })

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

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return
    if (!messages?.length) return
    try {
      handler.handler.call(sock, { messages })
    } catch (e) {
      console.error(e)
    }
  })

  sock.ev.on("connection.update", async update => {
    const { qr, connection, lastDisconnect } = update
    const reason = lastDisconnect?.error?.output?.statusCode

    if (qr && option === "1") {
      console.log("\nEscanea el código QR:\n")
      require("qrcode-terminal").generate(qr, { small: true })
    }

    if (connection === "open") {
      console.log(chalk.greenBright("✿ Conectado"))

      const file = "./lastRestarter.json"
      if (fs.existsSync(file)) {
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf-8"))
          if (data?.chatId && data?.key) {
            await sock.sendMessage(
              data.chatId,
              {
                text: `✅ *${global.namebot} está en línea nuevamente* 🚀`,
                edit: data.key
              }
            )
          }
          fs.unlinkSync(file)
        } catch (e) {
          console.error(e)
        }
      }
    }

    if (connection === "close") {
      if (reason === DisconnectReason.loggedOut) process.exit(0)
      setTimeout(startSock, 2000)
    }
  })
}

await loadPlugins(pluginRoot)
await startSock()

process.on("uncaughtException", console.error)
process.on("unhandledRejection", console.error)