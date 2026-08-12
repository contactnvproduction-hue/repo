import crypto from 'crypto'

// Chiffrement réversible (AES-256-GCM) des identifiants sensibles des clients
// (logs de leurs canaux d'acquisition). La clé dérive d'un secret serveur.
const RAW = process.env.NV_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'nv-dev-fallback-key'
const KEY = crypto.createHash('sha256').update(RAW).digest() // 32 octets
const PREFIX = 'enc:v1:'

export function encrypt(plain: string | null | undefined): string {
  if (!plain) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decrypt(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.startsWith(PREFIX)) return value // valeur historique en clair
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64')
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch { return '' }
}

// Chiffre / déchiffre uniquement les champs `login` (identifiants), pas les bios.
export function encryptLogins(channelData: any, channelLogins: any) {
  const cd: any = { ...(channelData || {}) }
  for (const k of Object.keys(cd)) if (cd[k]?.login) cd[k] = { ...cd[k], login: encrypt(cd[k].login) }
  const cl = Array.isArray(channelLogins) ? channelLogins.map((l: any) => ({ ...l, login: l?.login ? encrypt(l.login) : l?.login })) : channelLogins
  return { channelData: cd, channelLogins: cl }
}
export function decryptLogins(channelData: any, channelLogins: any) {
  const cd: any = { ...(channelData || {}) }
  for (const k of Object.keys(cd)) if (cd[k]?.login) cd[k] = { ...cd[k], login: decrypt(cd[k].login) }
  const cl = Array.isArray(channelLogins) ? channelLogins.map((l: any) => ({ ...l, login: l?.login ? decrypt(l.login) : l?.login })) : channelLogins
  return { channelData: cd, channelLogins: cl }
}
