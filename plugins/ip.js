import axios from 'axios'
import dns from 'dns/promises'

const isValidIP = (ip) => {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  const ipv6 = /^(([0-9a-fA-F]{1,4}):){7}([0-9a-fA-F]{1,4})$/
  return ipv4.test(ip) || ipv6.test(ip)
}

const handler = async (m, { conn, args }) => {
  const ip = (args[0] || '').trim()

  if (!ip) return m.reply('❌ Usa:\n.ip 8.8.8.8')
  if (!isValidIP(ip)) return m.reply('❌ IP inválida.')

  await m.react('🔎')

  let data = {}

  /* ================= API 1 ================= */
  try {
    const r = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,reverse,mobile,proxy,hosting`)
    if (r.data.status === 'success') {
      data = { ...data, ...r.data }
    }
  } catch {}

  /* ================= API 2 ================= */
  try {
    const r = await axios.get(`https://ipwho.is/${ip}`)
    if (r.data.success) {
      data = {
        ...data,
        continent: r.data.continent,
        continent_code: r.data.continent_code,
        currency: r.data.currency?.name,
        currency_code: r.data.currency?.code,
        flag: r.data.flag?.emoji,
        calling_code: r.data.calling_code,
        languages: r.data.languages,
        connection_type: r.data.connection?.type
      }
    }
  } catch {}

  /* ================= API 3 ================= */
  try {
    const r = await axios.get(`https://ipinfo.io/${ip}/json`)
    if (r.data) {
      data = {
        ...data,
        hostname: r.data.hostname,
        company: r.data.org,
        network: r.data.network
      }
    }
  } catch {}

  /* ================= API 4 ================= */
  try {
    const r = await axios.get(`https://ipapi.co/${ip}/json/`)
    if (!r.data.error) {
      data = {
        ...data,
        postal: r.data.postal,
        country_capital: r.data.country_capital,
        country_area: r.data.country_area
      }
    }
  } catch {}

  /* ================= Reverse DNS extra ================= */
  try {
    const hostnames = await dns.reverse(ip)
    if (hostnames.length) data.reverse_dns = hostnames.join(', ')
  } catch {}

  if (!Object.keys(data).length)
    return m.reply('❌ No se pudo obtener información.')

  const maps =
    data.lat && data.lon
      ? `https://www.google.com/maps?q=${data.lat},${data.lon}`
      : 'N/A'

  const texto = `
🌐 *IP INTEL COMPLETO*
━━━━━━━━━━━━━━━━━━
🔢 IP: ${ip}
🖥 Hostname: ${data.hostname || data.reverse || data.reverse_dns || 'N/A'}

🌍 Continente: ${data.continent || 'N/A'}
🏳 País: ${data.country || 'N/A'} ${data.flag || ''}
🔠 Código País: ${data.countryCode || 'N/A'}
📞 Código Telefónico: ${data.calling_code || 'N/A'}
🗺 Región: ${data.regionName || 'N/A'}
🏙 Ciudad: ${data.city || 'N/A'}
📮 Postal: ${data.zip || data.postal || 'N/A'}

📍 Lat: ${data.lat || 'N/A'}
📍 Lon: ${data.lon || 'N/A'}
🗺 Google Maps: ${maps}
🕒 Zona Horaria: ${data.timezone || 'N/A'}

🏢 ISP: ${data.isp || 'N/A'}
🏛 Organización: ${data.org || data.company || 'N/A'}
🧬 ASN: ${data.as || 'N/A'}
🌐 Red: ${data.network || 'N/A'}
🔌 Tipo Conexión: ${data.connection_type || 'N/A'}

📱 Móvil: ${data.mobile ?? 'N/A'}
🛡 Proxy/VPN: ${data.proxy ?? 'N/A'}
🏢 Hosting/DataCenter: ${data.hosting ?? 'N/A'}

💰 Moneda: ${data.currency || 'N/A'} (${data.currency_code || 'N/A'})
🗣 Idiomas: ${data.languages || 'N/A'}
🏛 Capital: ${data.country_capital || 'N/A'}
📏 Área País: ${data.country_area || 'N/A'}
`.trim()

  await conn.sendMessage(m.chat, { text: texto }, { quoted: m })
}

handler.help = ['ip <direccion>']
handler.tags = ['herramientas']
handler.command = ['ip']

export default handler