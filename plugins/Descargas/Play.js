import fetch from "node-fetch"

const UA = {
 headers: {
  "user-agent":
   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 }
}

async function searchYT(q){

 const res = await fetch(
  "https://www.youtube.com/results?search_query=" +
   encodeURIComponent(q),
  UA
 )

 const html = await res.text()

 const id = html.match(/"videoId":"(.*?)"/)?.[1]

 if(!id) return null

 return id
}

async function getMp3(videoId){

 const res = await fetch(
  `https://api.vevioz.com/api/button/mp3/${videoId}`,
  UA
 )

 const html = await res.text()

 const link = html.match(/href="(https:[^"]+\.mp3[^"]*)"/)?.[1]

 if(!link) return null

 return link
}

let handler = async (m,{ conn, args }) => {

 const text = args.join(" ")

 if(!text)
  return conn.sendMessage(
   m.chat,
   { text:"Escribe algo para buscar" },
   { quoted:m }
  )

 await conn.sendMessage(m.chat,{
  react:{
   text:"🙈",
   key:m.key
  }
 })

 try{

  const id = await searchYT(text)

  if(!id)
   return conn.sendMessage(
    m.chat,
    { text:"No encontrado" },
    { quoted:m }
   )

  const mp3 = await getMp3(id)

  if(!mp3)
   return conn.sendMessage(
    m.chat,
    { text:"Error obteniendo audio" },
    { quoted:m }
   )

  await conn.sendMessage(
   m.chat,
   {
    audio:{ url: mp3 },
    mimetype:"audio/mpeg",
    fileName:"play.mp3"
   },
   { quoted:m }
  )

 }catch{

  conn.sendMessage(
   m.chat,
   { text:"Error" },
   { quoted:m }
  )

 }
}

handler.command = ["play"]

export default handler