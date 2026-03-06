import {
 getContentType,
 downloadContentFromMessage,
 jidNormalizedUser
} from "@whiskeysockets/baileys"

export const delay = ms => new Promise(r=>setTimeout(r,ms))

const DIGITS = s => String(s||"").replace(/\D/g,"")

const jidCache = new Map()
const JID_CACHE_LIMIT = 3000

export function decodeJid(jid){

 if(!jid) return jid

 const cached = jidCache.get(jid)
 if(cached) return cached

 let normalized

 try{
  normalized = jidNormalizedUser(jid)
 }catch{
  normalized = jid
 }

 jidCache.set(jid,normalized)

 if(jidCache.size > JID_CACHE_LIMIT)
  jidCache.delete(jidCache.keys().next().value)

 return normalized
}

async function streamToBuffer(stream){

 if(!stream) return Buffer.alloc(0)

 const chunks=[]

 for await(const chunk of stream)
  chunks.push(chunk)

 return Buffer.concat(chunks)
}

export async function smsg(conn,raw){

 if(!raw?.message) return raw

 const msg = raw.message

 const text =
  msg.conversation ||
  msg?.extendedTextMessage?.text ||
  msg?.imageMessage?.caption ||
  msg?.videoMessage?.caption

 if(!text) return raw

 const key = raw.key

 const mtype = getContentType(msg)
 if(!mtype) return raw

 const content = msg[mtype]

 const userJid = conn.user?.id
  ? decodeJid(conn.user.id)
  : null

 const m = raw

 m.id = key.id
 m.chat = decodeJid(key.remoteJid)
 m.fromMe = key.fromMe === true
 m.isGroup = m.chat.endsWith("@g.us")

 const sender = m.fromMe ? userJid : key.participant || m.chat

 m.sender = decodeJid(sender)
 m.senderNum = DIGITS(m.sender)

 m.isBaileys = typeof key.id === "string" && key.id.startsWith("BAE5")

 m.mtype = mtype
 m.msg = content
 m.text = text

 const ctx = content.contextInfo

 if(ctx?.mentionedJid)
  m.mentionedJid = ctx.mentionedJid

 m.reply = (text,chat=m.chat,opts={}) =>
  conn.sendMessage(chat,{text,...opts},{quoted:m})

 const type = mtype.replace("Message","")

 m.download = async () =>
  streamToBuffer(
   await downloadContentFromMessage(content,type)
  )

 return m
}