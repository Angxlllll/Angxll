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

 return id
}

async function getAudio(videoId){

 const body = {
  context:{
   client:{
    clientName:"ANDROID",
    clientVersion:"18.11.34"
   }
  },
  videoId:videoId
 }

 const res = await fetch(
  "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
  {
   method:"POST",
   headers:{
    ...UA.headers,
    "content-type":"application/json"
   },
   body:JSON.stringify(body)
  }
 )

 const json = await res.json()

 const formats =
  json?.streamingData?.adaptiveFormats || []

 const audio = formats.find(v =>
  v.mimeType?.includes("audio")
 )

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
   text:"🎧",
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

  const audio = await getAudio(id)

  if(!audio)
   return conn.sendMessage(
    m.chat,
    { text:"No se pudo obtener audio" },
    { quoted:m }
   )

  await conn.sendMessage(
   m.chat,
   {
    audio:{ url: audio },
    mimetype:"audio/mpeg",
    fileName:"play.mp3"
   },
   { quoted:m }
  )

 }catch{

  conn.sendMessage(
   m.chat,
   { text:"Error descargando audio" },
   { quoted:m }
  )

 }
}

handler.command = ["play"]

export default handler