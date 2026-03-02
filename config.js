import yargs from 'yargs'

global.opts = yargs(process.argv.slice(2))
  .exitProcess(false)
  .parse()

const OWNER = Object.freeze([
  '43590411624639',
  '226044783132714',
  '205819731832938'
])

const BOT = Object.freeze({
  name: '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
  alias: '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
  packname: '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍',
  author: '𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝗇𝗀𝖾𝗅',
  session: 'AngelBot',
  banner: 'https://files.catbox.moe/0fer0y.jpg'
})

global.owner = OWNER
global.bot = BOT

global.namebot = BOT.name
global.botname = BOT.alias
global.packname = BOT.packname
global.author = BOT.author
global.sessions = BOT.session
global.banner = BOT.banner


const APIS = Object.freeze({
  may: 'https://mayapi.ooguy.com'
})

const API_KEYS = Object.freeze({
  may: process.env.MAY_API_KEY ?? 'may-684934ab'
})

global.APIs = APIS
global.APIKeys = API_KEYS