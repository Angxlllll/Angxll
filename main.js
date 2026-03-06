import "./lib/before.js"
import "./config.js"

import fs from "fs"
import path from "path"
import chalk from "chalk"
import pino from "pino"
import NodeCache from "node-cache"
import readlineSync from "readline-sync"
import { fileURLToPath } from "url"
import qrcode from "qrcode-terminal"

import store from "./lib/store.js"

import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  jidNormalizedUser
} from "@whiskeysockets/baileys"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

global.plugins = Object.create(null)
global.COMMAND_ROUTER = Object.create(null)

global.PREFIX_SET = new Set([46,33,35,47,36])

const SESSION_DIR = global.sessions || "./Sessions/Owner"

fs.mkdirSync(SESSION_DIR, { recursive: true })

const msgRetryCounterCache = new NodeCache({ stdTTL: 30 })
const userDevicesCache = new NodeCache({ stdTTL: 120 })

const DIGITS = s => String(s).replace(/\D/g, "")

function normalizePhone(input){
 let s = DIGITS(input)
 if(!s) return ""

 if(s.startsWith("0"))
  s = s.replace(/^0+/, "")

 if(s.startsWith("52") && !s.startsWith("521") && s.length >= 12)
  s = "521" + s.slice(2)

 if(s.startsWith("54") && !s.startsWith("549") && s.length >= 11)
  s = "549" + s.slice(2)

 return s
}

let option = ""
let phoneNumber = ""

const methodQR = process.argv.includes("--qr")
const methodCode = process.argv.includes("--code")

if(methodQR) option = "1"
else if(methodCode) option = "2"
else if(!fs.existsSync(`${SESSION_DIR}/creds.json`)){

 option = readlineSync.question(
  chalk.bold.white("\nSeleccione una opción:\n") +
  chalk.blueBright("1. Código QR\n") +
  chalk.cyan("2. Código de texto\n--> ")
 )

 while(!/^[12]$/.test(option))
  option = readlineSync.question("--> ")

 if(option === "2"){

  const phoneInput = readlineSync.question(
   chalk.cyanBright("\nIngresa tu número con código país:\n--> ")
  )

  phoneNumber = normalizePhone(phoneInput)
 }
}

function rebuildPluginIndex(){

 const router = Object.create(null)

 for(const plugin of Object.values(global.plugins)){

  if(!plugin || plugin.disabled) continue

  let cmds = plugin.command
  if(!cmds) continue

  if(!Array.isArray(cmds))
   cmds = [cmds]

  for(const cmd of cmds)
   router[cmd.toLowerCase()] = plugin
 }

 global.COMMAND_ROUTER = router
}

async function loadPlugins(dir){

 const entries = await fs.promises.readdir(dir,{withFileTypes:true})
 const tasks = []

 for(const entry of entries){

  const full = path.join(dir,entry.name)

  if(entry.isDirectory())
   tasks.push(loadPlugins(full))

  else if(entry.name.endsWith(".js")){
   tasks.push(
    import(full).then(m=>{
     global.plugins[full] = m.default || m
    })
   )
  }
 }

 await Promise.all(tasks)

 rebuildPluginIndex()
}

const handler = await import("./handler.js")

let currentSock = null
let isStarting = false

async function startSock(){

 if(isStarting) return
 isStarting = true

 if(currentSock){
  try{
   currentSock.ev.removeAllListeners()
   currentSock.ws.close()
  }catch{}
 }

 const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
 const { version } = await fetchLatestBaileysVersion()

 const logger = pino({ level:"silent" })

 const sock = makeWASocket({

  version,
  logger,
  printQRInTerminal:false,
  browser:Browsers.macOS("Chrome"),

  auth:{
   creds:state.creds,
   keys:makeCacheableSignalKeyStore(state.keys,logger)
  },

  syncFullHistory:false,
  markOnlineOnConnect:true,

  msgRetryCounterCache,
  userDevicesCache,

  keepAliveIntervalMs:20000
 })

 currentSock = sock
 global.conn = sock

 store.bind(sock)

 sock.ev.on("creds.update",saveCreds)

 if(option === "2" && !fs.existsSync(`${SESSION_DIR}/creds.json`)){

  setTimeout(async()=>{

   if(!state.creds.registered){

    const pairing = await sock.requestPairingCode(phoneNumber)

    const code = pairing?.match(/.{1,4}/g)?.join("-") || pairing

    console.log("\nCódigo de emparejamiento:\n")
    console.log(code)
   }

  },3000)
 }

 sock.ev.on("messages.upsert",update=>{

  if(update.type !== "notify") return

  const msgs = update.messages
  if(!msgs?.length) return

  const filtered = []

  for(const m of msgs){

   if(!m?.message) continue

   const jid = m.key?.remoteJid
   if(!jid || jid === "status@broadcast") continue

   const msg = m.message

   const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    ""

   if(!text) continue

   const c = text.charCodeAt(0)

   if(!global.PREFIX_SET.has(c))
    continue

   filtered.push(m)
  }

  if(filtered.length)
   handler.handler.call(sock,{messages:filtered})

 })

 sock.ev.on("connection.update",update=>{

  const { qr,connection,lastDisconnect } = update

  const reason = lastDisconnect?.error?.output?.statusCode

  if(qr && option === "1"){
   console.log("\nEscanea el QR:\n")
   qrcode.generate(qr,{small:true})
  }

  if(connection === "open"){

   global.botNumber = DIGITS(jidNormalizedUser(sock.user.id))

   console.log(chalk.greenBright("✿ Conectado"))

   isStarting = false
  }

  if(connection === "close"){

   if(reason === DisconnectReason.loggedOut)
    process.exit(0)

   else{
    isStarting = false
    setTimeout(startSock,3000)
   }
  }

 })

}

await loadPlugins(path.join(__dirname,"plugins"))

await startSock()

process.on("uncaughtException",console.error)
process.on("unhandledRejection",console.error)