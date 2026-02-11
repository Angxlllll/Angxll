import { fileURLToPath } from 'url'
import path from 'path'
import yargs from 'yargs'

global.opts = yargs(process.argv.slice(2))
  .exitProcess(false)
  .parse()

const OWNER = Object.freeze([
  '5215911153853@s.whatsapp.net',
  '226044783132714',
  '226044783132714@lid',
  '205819731832938@s.whatsapp.net'
])

const BOT = Object.freeze({
  name: '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
  alias: '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
  packname: '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
  author: '𝖠𝗇𝗀𝖾𝗅',
  session: '𝖠𝗇𝗀𝖾𝗅𝖡𝗈𝗍',
  banner: 'https://files.catbox.moe/0fer0y.jpg'
})

const APIS = Object.freeze({
  may: 'https://mayapi.ooguy.com'
})

const API_KEYS = Object.freeze({
  may: process.env.MAY_API_KEY ?? 'may-684934ab'
})

global.owner = OWNER
global.bot = BOT

global.namebot = BOT.name
global.botname = BOT.alias
global.packname = BOT.packname
global.author = BOT.author
global.sessions = BOT.session
global.banner = BOT.banner

global.APIs = APIS
global.APIKeys = API_KEYS

global.__filename = p => fileURLToPath(p)

global.prefixes = Object.freeze(['.', '!', '#', '/'])
global.sinprefix = false