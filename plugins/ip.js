import axios from 'axios'
import dns from 'dns/promises'

const isValidIP = (ip) => {
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  const ipv6 = /^(([0-9a-fA-F]{1,4}):){7}([0-9a-fA-F]{1,4})$/
  return ipv4.test(ip) || ipv6.test(ip)
}

const handler = async (m, { conn, args }) => {
  const ip = (args[0] || '').trim()

  if (!ip) {
    await conn.sendMessage(m.chat, {
      react: { text: '⚠️', key: m.key }
    })
    return m.reply('❌ Usa:\n.ip 8.8.8.8')
  }

  if (!isValidIP(ip)) {
    await conn.sendMessage(m.chat, {
      react: { text: '❌', key: m.key }
    })
    return m.reply('❌ IP inválida.')
  }

  await conn.sendMessage(m.chat, {
    react: { text: '🔎', key: m.key }
  })

  try {
    let data = {}

    try {
      const r = await axios.get(`https://ipwho.is/${ip}`, { timeout: 7000 })
      if (r.data.success) {
        data = {
          ...data,
          country: r.data.country,
          region: r.data.region,
          city: r.data.city,
          lat: r.data.latitude,
          lon: r.data.longitude,
          timezone: r.data.timezone?.id,
          isp: r.data.connection?.isp,
          org: r.data.connection?.org,
          continent: r.data.continent,
          flag: r.data.flag?.emoji,
          calling_code: r.data.calling_code
        }
      }
    } catch {}

    try {
      const r = await axios.get(`https://ipinfo.io/${ip}/json`, { timeout: 7000 })
      if (r.data) {
        data = {
          ...data,
          hostname: r.data.hostname,
          company: r.data.org,
          network: r.data.network
        }
      }
    } catch {}

    try {
      const host = await dns.reverse(ip)
      if (host.length) data.reverse_dns = host.join(', ')
    } catch {}

    if (!Object.keys(data).length) {
      await conn.sendMessage(m.chat, {
        react: { text: '⚠️', key: m.key }
      })
      return m.reply('❌ No se pudo obtener información.')
    }

    const maps =
      data.lat && data.lon
        ? `https://www.google.com/maps?q=${data.lat},${data.lon}`
        : 'N/A'

    const texto = `
🌐 *IP LOOKUP*
━━━━━━━━━━━━━━
🔢 IP: ${ip}
🖥 Hostname: ${data.hostname || data.reverse_dns || 'N/A'}

🌍 Continente: ${data.continent || 'N/A'}
🏳 País: ${data.country || 'N/A'} ${data.flag || ''}
🗺 Región: ${data.region || 'N/A'}
🏙 Ciudad: ${data.city || 'N/A'}

📍 Lat: ${data.lat || 'N/A'}
📍 Lon: ${data.lon || 'N/A'}
🗺 Maps: ${maps}
🕒 Zona Horaria: ${data.timezone || 'N/A'}

🏢 ISP: ${data.isp || 'N/A'}
🏛 Organización: ${data.org || data.company || 'N/A'}
🌐 Red: ${data.network || 'N/A'}
📞 Código País: ${data.calling_code || 'N/A'}
`.trim()

    await conn.sendMessage(m.chat, {
      react: { text: '✅', key: m.key }
    })

    await conn.sendMessage(m.chat, { text: texto }, { quoted: m })

  } catch (err) {
    await conn.sendMessage(m.chat, {
      react: { text: '❌', key: m.key }
    })
    m.reply('⚠️ Error interno.')
  }
}

handler.help = ['ip <direccion>']
handler.tags = ['herramientas']
handler.command = /^ip$/i

export default handler