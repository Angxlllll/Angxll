import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

let handler = async (m, { conn, args, isOwner, isROwner }) => {

  if (!isOwner && !isROwner) {
    await conn.sendMessage(m.chat, {
      text: `⚡ *MODO GOHAN BEAST - ACCESO DENEGADO* ⚡

❌ Solo el propietario puede activar este poder.`
    }, { quoted: m });

    await conn.sendMessage(m.chat, {
      react: { text: "🥇", key: m.key }
    });
    return;
  }

  await conn.sendMessage(m.chat, {
    react: { text: "🥇", key: m.key }
  });

  const startTime = Date.now();

  await conn.sendMessage(m.chat, {
    text: `🦖 *MODO GOHAN BEAST ACTIVADO* 🦖

» Escaneando sistema...
» Eliminando basura segura...`
  }, { quoted: m });

  const PROTECTED_PATHS = [
    path.resolve('./node_modules'),
    path.resolve('./.git')
  ];

  const PROTECTED_FILES = [
    'package-lock.json'
  ];

  const downloadFolders = [
    './downloads',
    './tmp',
    './temp',
    './cache',
    './sessions',
    './media',
    './audio',
    './videos',
    './images',
    './thumbnails',
    './sticker',
    './database/backup',
    './node_modules/.cache',
    './.npm-cache',
    process.cwd() + '/downloads',
    './sesiones',
    './.temp'
  ];

  const garbageExtensions = [
    '.mp3','.m4a','.opus','.ogg','.wav','.aac',
    '.mp4','.mov','.avi','.mkv','.webm','.flv',
    '.jpg','.jpeg','.png','.webp','.gif','.ico',
    '.pdf','.doc','.docx','.ppt','.pptx','.xls','.xlsx',
    '.zip','.rar','.7z','.tar','.gz',
    '.tmp','.temp','.cache','.log','.bak','.backup'
  ];

  const beastMode = args.includes('--beast') || args.includes('-b');
  const ultraBeast = args.includes('--ultra') || args.includes('-u');

  function isProtected(filePath) {
    const resolved = path.resolve(filePath);

    if (PROTECTED_PATHS.some(p => resolved.startsWith(p))) return true;

    const base = path.basename(filePath);
    if (PROTECTED_FILES.includes(base)) return true;

    return false;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  function getFolderSize(folderPath) {
    let size = 0;
    if (!fs.existsSync(folderPath)) return size;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      if (isProtected(filePath)) continue;

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getFolderSize(filePath);
      } else {
        size += stat.size;
      }
    }
    return size;
  }

  async function deleteGarbage(folder) {
    if (!fs.existsSync(folder)) return;

    const files = fs.readdirSync(folder);

    for (const file of files) {
      const filePath = path.join(folder, file);

      if (isProtected(filePath)) continue;

      try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          await deleteGarbage(filePath);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (garbageExtensions.includes(ext)) {
            totalDeleted++;
            totalSize += stat.size;
            fs.unlinkSync(filePath);
          }
        }
      } catch {}
    }
  }

  let totalDeleted = 0;
  let totalSize = 0;

  for (const folder of downloadFolders) {
    await deleteGarbage(folder);
  }

  try {
    if (process.platform === 'win32') {
      await execPromise('del /q/f/s %TEMP%\\*');
    } else {
      await execPromise('rm -rf /tmp/*');
    }
  } catch {}

  const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

  const finalMessage = `🦖 *GOHAN BEAST CLEANER*

🗑️ Eliminados: ${totalDeleted}
💾 Liberado: ${formatBytes(totalSize)}
⚡ Modo: ${ultraBeast ? 'ULTRA' : beastMode ? 'BEAST' : 'Normal'}
⏱️ Tiempo: ${executionTime}s

🔒 Protección activa:
• node_modules
• .git
• package-lock.json`;

  await conn.sendMessage(m.chat, {
    text: finalMessage
  }, { quoted: m });

  await conn.sendMessage(m.chat, {
    react: { text: "🥇", key: m.key }
  });
};

handler.help = ['deletebs'];
handler.tags = ['tools'];
handler.command = /^(deletebs|limpiar|cleanup|cleanbeast)$/i;
handler.rowner = true;
handler.owner = true;

export default handler;