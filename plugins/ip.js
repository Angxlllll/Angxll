import axios from "axios"

const get = async url => {
  try {
    const { data } = await axios.get(url, { timeout: 8000 })
    return data
  } catch {
    return null
  }
}

const handler = async (m, { args }) => {

  const code = (args[0] || "").trim()

  if (!code) {
    return m.reply("Uso:\n.postal 90210")
  }

  const zip = await get(`https://api.zippopotam.us/us/${code}`)
  const geo = await get(`https://nominatim.openstreetmap.org/search?postalcode=${code}&format=json&limit=1`)
  const country = zip?.country

  let countryInfo = null
  if (country) {
    countryInfo = await get(`https://restcountries.com/v3.1/name/${country}`)
  }

  let data = {}

  if (zip) {
    const place = zip.places?.[0]

    data.country = zip.country
    data.countryCode = zip["country abbreviation"]
    data.city = place?.["place name"]
    data.state = place?.state
    data.lat = place?.latitude
    data.lon = place?.longitude
  }

  if (geo?.length) {
    data.display = geo[0].display_name
  }

  if (countryInfo?.[0]) {
    const c = countryInfo[0]

    data.continent = c.continents?.[0]
    data.capital = c.capital?.[0]
    data.population = c.population
    data.currency = Object.values(c.currencies || {})?.[0]?.name
    data.languages = Object.values(c.languages || {}).join(", ")
    data.flag = c.flag
    data.phone = c.idd?.root + (c.idd?.suffixes?.[0] || "")
  }

  const maps =
    data.lat && data.lon
      ? `https://www.google.com/maps?q=${data.lat},${data.lon}`
      : "N/A"

  const txt = `
📮 REPORTE POSTAL
━━━━━━━━━━━━━━

🔢 Código Postal: ${code}

🏙 Ciudad: ${data.city || "N/A"}
🗺 Estado: ${data.state || "N/A"}
🌍 País: ${data.country || "N/A"} ${data.flag || ""}

📍 Latitud: ${data.lat || "N/A"}
📍 Longitud: ${data.lon || "N/A"}

🗺 Google Maps
${maps}

🌎 Continente: ${data.continent || "N/A"}
🏛 Capital: ${data.capital || "N/A"}

👥 Población país: ${data.population?.toLocaleString() || "N/A"}

💰 Moneda: ${data.currency || "N/A"}
🗣 Idiomas: ${data.languages || "N/A"}

📞 Prefijo telefónico: ${data.phone || "N/A"}

📍 Dirección completa:
${data.display || "N/A"}
`.trim()

  await m.reply(txt)
}

handler.help = ["postal <codigo>"]
handler.tags = ["herramientas"]
handler.command = ['ip']

export default handler