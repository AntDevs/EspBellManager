/**
 * Authentication module matching EspBellAdmin (security.py & app.js)
 * Implements single-use 8-byte random nonce challenge and SHA-256 hash authentication
 */

export async function computeSha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function generateRandomNonce(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function authenticateWithPassword(password: string, nonce: string): Promise<string> {
  // Matches security.py: auth_hash = sha256(password + nonce)
  return await computeSha256(password + nonce);
}

/**
 * Obfuscates or decrypts password for config display (mimicking AES-128-CBC / ENC: prefix from security.py)
 */
export function formatEncryptedPassword(raw: string): string {
  if (raw.startsWith('ENC:')) return raw;
  // Simple deterministic XOR-hex encoder for mock persistence
  const key = 0x5a;
  const hex = Array.from(raw).map(c => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
  return `ENC:${hex}`;
}

export function formatDecryptedPassword(enc: string): string {
  if (!enc.startsWith('ENC:')) return enc;
  const hex = enc.slice(4);
  const key = 0x5a;
  let res = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16) ^ key;
    res += String.fromCharCode(code);
  }
  return res || 'admin';
}
