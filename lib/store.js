import { readFile, writeFile, access } from 'fs/promises'
import {
  initAuthCreds,
  BufferJSON,
  proto
} from '@whiskeysockets/baileys'

import { decodeJid } from './lib/simple.js'

function bind(conn) {
  if (conn.__storeBound) return
  conn.__storeBound = true

  const chats = conn.chats ||= Object.create(null)

  conn.ev.on('groups.update', updates => {
    if (!updates) return
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i]
      const id = decodeJid(u.id)
      if (!id || !id.endsWith('@g.us')) continue
      const chat = chats[id] ||= { id }
      if (u.subject) chat.subject = u.subject
    }
  })
}

const KEY_MAP = {
  'pre-key': 'preKeys',
  session: 'sessions',
  'sender-key': 'senderKeys',
  'app-state-sync-key': 'appStateSyncKeys',
  'app-state-sync-version': 'appStateVersions',
  'sender-key-memory': 'senderKeyMemory'
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function useSingleFileAuthState(file, logger) {
  let creds = initAuthCreds()
  let keys = Object.create(null)
  let dirty = false
  let saving = false
  let saveTimer = null

  const load = async () => {
    if (!(await fileExists(file))) return
    try {
      const raw = await readFile(file)
      const data = JSON.parse(raw, BufferJSON.reviver)
      creds = data.creds || creds
      keys = data.keys || keys
    } catch {
      creds = initAuthCreds()
      keys = Object.create(null)
    }
  }

  const save = async () => {
    if (!dirty || saving) return
    saving = true
    dirty = false
    try {
      await writeFile(
        file,
        JSON.stringify({ creds, keys }, BufferJSON.replacer)
      )
      logger?.trace?.('auth state saved')
    } finally {
      saving = false
    }
  }

  const scheduleSave = () => {
    dirty = true
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      save()
    }, 400)
  }

  load()

  return {
    state: {
      get creds() {
        return creds
      },
      keys: {
        get(type, ids) {
          const store = keys[KEY_MAP[type]]
          if (!store) return {}
          const out = Object.create(null)
          for (let i = 0; i < ids.length; i++) {
            let v = store[ids[i]]
            if (!v) continue
            if (type === 'app-state-sync-key')
              v = proto.AppStateSyncKeyData.fromObject(v)
            out[ids[i]] = v
          }
          return out
        },
        set(data) {
          for (const type in data) {
            const key = KEY_MAP[type]
            keys[key] ||= Object.create(null)
            Object.assign(keys[key], data[type])
          }
          scheduleSave()
        }
      }
    },
    saveState: save
  }
}

export default {
  bind,
  useSingleFileAuthState
}