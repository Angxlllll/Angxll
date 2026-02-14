import "./config.js"

import fs from "fs"
import path from "path"
import readline from "readline"
import chalk from "chalk"
import pino from "pino"
import NodeCache from "node-cache"
import { fileURLToPath } from "url"

import baileys from "@whiskeysockets/baileys"
import store from "./lib/store.js"

const {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} = baileys

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.groupMetadata = new Map()
global.plugins = Object.create(null)
global.COMMAND_MAP = new Map()

const SESSION_DIR = global.sessions || "sessions"
const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

const msgRetryCounterCache = new NodeCache({ stdTTL: 30 })
const userDevicesCache = new NodeCache({ stdTTL: 120 })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = q => new Promise(r => rl.question(q, r))

let option = process.argv.includes("qr") ? "1" : null
let phoneNumber = global.botNumber

if (!option && !phoneNumber && !fs.existsSync(`./${SESSION_DIR}/creds.json`)) {
  do {
    option = await question(
      chalk.bold.white("Seleccione una opción:\n") +
      chalk.blue("1. Código QR\n") +
      chalk.cyan("2. Código de texto\n--> ")
    )
  } while (!/^[12]$/.test(option))
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
      const m = await import(`${full}?update=${Date.now()}`)
      global.plugins[full] = m.default || m
    }
  }
  rebuildPluginIndex()
}

const handler = await import("./handler.js")

async function startSock() {
  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: option === "1",
    browser: ["Android", "Chrome", "120"],
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: "fatal" })
      )
    },
    syncFullHistory: false,
    markOnlineOnConnect: false,
    emitOwnEvents: false,
    generateHighQualityLinkPreview: false,
    msgRetryCounterCache,
    userDevicesCache,
    keepAliveIntervalMs: 55000,
    getMessage: async () => undefined
  })

  global.conn = sock
  store.bind(sock)

  let pairingRequested = false

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return
    if (!messages?.length) return
    handler.handler.call(sock, { messages })
  })

  sock.ev.on("connection.update", async update => {
    const { connection, lastDisconnect } = update
    const reason = lastDisconnect?.error?.output?.statusCode

    if (
      option === "2" &&
      !pairingRequested &&
      !fs.existsSync(`./${SESSION_DIR}/creds.json`) &&
      (connection === "connecting" || connection === "open")
    ) {
      pairingRequested = true
      console.log(chalk.cyanBright("\nIngresa tu número con código país"))
      phoneNumber = await question("--> ")
      const code = await sock.requestPairingCode(
        phoneNumber.replace(/\D/g, "")
      )
      console.log(chalk.greenBright("\nCódigo de vinculación:\n"))
      console.log(chalk.bold(code.match(/.{1,4}/g).join(" ")))
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