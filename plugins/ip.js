import axios from 'axios'
import dns from 'dns/promises'

const isValidIP = ip => {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  const ipv6 = /^(([0-9a-fA-F]{1,4}):){7}([0-9a-fA-F]{1,4})$/
  return ipv4.test(ip) || ipv6.test(ip)
}

const get = async (url) => {
  try {
    const { data } = await axios.get(url, { timeout: 7000 })
    return data
  } catch {
    return null
  }
}

const handler = async (m, { conn, args }) => {
  const ip = (args[0] || '').trim()

  if (!ip) {
    await conn.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
    return m.reply('Usa:\n.ip 8.8.8.8')
  }

  if (!isValidIP(ip)) {
    await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    return m.reply('IP inválida')
  }

  await conn.sendMessage(m.chat, { react: { text: '🔎', key: m.key } })

  let data = {}

  const [ipwho, ipinfo, ipapi, ipapiis] = await Promise.all([
    get(`https://ipwho.is/${ip}`),
    get(`https://ipinfo.io/${ip}/json`),
    get(`https://ipapi.co/${ip}/json/`),
    get(`https://api.ipapi.is/?q=${ip}`)
  ])

  if (ipwho?.success) {
    data.country = ipwho.country
    data.region = ipwho.region
    data.city = ipwho.city
    data.lat = ipwho.latitude
    data.lon = ipwho.longitude
    data.continent = ipwho.continent
    data.flag = ipwho.flag?.emoji
    data.timezone = ipwho.timezone?.id
    data.isp = ipwho.connection?.isp
    data.org = ipwho.connection?.org
    data.asn = ipwho.connection?.asn
    data.calling = ipwho.calling_code
    data.currency = ipwho.currency?.code
  }

  if (ipinfo) {
    data.hostname = ipinfo.hostname
    data.network = ipinfo.network
    data.company = ipinfo.org
  }

  if (ipapi && !ipapi.error) {
    data.postal = ipapi.postal
    data.capital = ipapi.country_capital
    data.country_area = ipapi.country_area
    data.languages = ipapi.languages
  }

  if (ipapiis?.ip) {
    data.type = ipapiis.type
    data.rir = ipapiis.rir
    data.abuse = ipapiis.is_abuser
    data.datacenter = ipapiis.is_datacenter
    data.tor = ipapiis.is_tor
    data.proxy = ipapiis.is_proxy
    data.vpn = ipapiis.is_vpn
  }

  try {
    const reverse = await dns.reverse(ip)
    if (reverse.length) data.reverse = reverse.join(', ')
  } catch {}

  if (!Object.keys(data).length) {
    await conn.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } })
    return m.reply('No se pudo obtener información')
  }

  const maps =
    data.lat && data.lon
      ? `https://www.google.com/maps?q=${data.lat},${data.lon}`
      : 'N/A'

  const text = `
🌐 IP INTEL REPORT
━━━━━━━━━━━━━━━━━━
🔢 IP: ${ip}
🖥 Hostname: ${data.hostname || data.reverse || 'N/A'}

🌍 Continente: ${data.continent || 'N/A'}
🏳 País: ${data.country || 'N/A'} ${data.flag || ''}
🗺 Región: ${data.region || 'N/A'}
🏙 Ciudad: ${data.city || 'N/A'}
📮 Postal: ${data.postal || 'N/A'}

📍 Lat: ${data.lat || 'N/A'}
📍 Lon: ${data.lon || 'N/A'}
🗺 Maps: ${maps}
🕒 Zona Horaria: ${data.timezone || 'N/A'}

🏢 ISP: ${data.isp || 'N/A'}
🏛 Organización: ${data.org || data.company || 'N/A'}
🧬 ASN: ${data.asn || 'N/A'}
🌐 Red: ${data.network || 'N/A'}
🏢 RIR: ${data.rir || 'N/A'}

📞 Código País: ${data.calling || 'N/A'}
💰 Moneda: ${data.currency || 'N/A'}
🗣 Idiomas: ${data.languages || 'N/A'}
🏛 Capital: ${data.capital || 'N/A'}
📏 Área País: ${data.country_area || 'N/A'}

🔌 Tipo: ${data.type || 'N/A'}
🏢 Datacenter: ${data.datacenter ?? 'N/A'}
🛡 Proxy: ${data.proxy ?? 'N/A'}
🧿 VPN: ${data.vpn ?? 'N/A'}
🕶 Tor: ${data.tor ?? 'N/A'}
🚨 Abuse Flag: ${data.abuse ?? 'N/A'}
`.trim()

  await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  await m.reply(text)
}

handler.help = ['ip <direccion>']
handler.tags = ['herramientas']
handler.command = 'ip'

export default handler