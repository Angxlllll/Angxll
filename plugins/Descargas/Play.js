import fetch from "node-fetch"

const UA = {
 headers:{
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

 return "https://youtu.be/" + id
}

async function getMp3(url){

 const info = await fetch(
  "https://cdn.savetube.me/info?url=" + encodeURIComponent(url),
  UA
 ).then(v=>v.json())

 const audio = info?.data?.audio?.find(v=>v.ext==="mp3")

 if(!audio) return null

 return audio.url
}

let handler = async (m,{ conn, args }) => {

 const text = args.join(" ")

 if(!text)
  return conn.sendMessage(
   m.chat,
   { text:"Ejemplo: .play karma police" },
   { quoted:m }
  )

 await conn.sendMessage(m.chat,{
  react:{
   text:"🎵",
   key:m.key
  }
 })

 try{

  const yt = await searchYT(text)

  if(!yt)
   return conn.sendMessage(
    m.chat,
    { text:"No encontrado" },
    { quoted:m }
   )

  const mp3 = await getMp3(yt)

  if(!mp3)
   return conn.sendMessage(
    m.chat,
    { text:"No se pudo obtener audio" },
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

 }catch(e){

  conn.sendMessage(
   m.chat,
   { text:"Error descargando" },
   { quoted:m }
  )

 }
}

handler.command = ["play"]

export default handler