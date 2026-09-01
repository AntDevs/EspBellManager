/**
 * Authentication module matching EspBellAdmin (security.py & app.js)
 * Implements single-use 8-byte random nonce challenge and SHA-256 hash authentication
 */

// Pure JS SHA-256 fallback (no external dependencies needed)
function tinySha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = (ascii.length * 8) + '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [], k = [];
  let primeCounter = k.length;
  const isComposite: { [key: number]: number } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII only
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength) | 0;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) 
        + ((e & hash[5]) ^ ((~e) & hash[6])) 
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0
        );
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) 
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

export async function computeSha256(text: string): Promise<string> {
  // If Web Crypto API is unavailable (e.g. running on non-HTTPS like http://192.168.4.1), use fallback
  if (!window.crypto || !window.crypto.subtle) {
    console.warn('Web Crypto API (window.crypto.subtle) is unavailable, falling back to pure JS sha256');
    return tinySha256(text);
  }

  try {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('crypto.subtle.digest failed:', err);
    return tinySha256(text);
  }
}

export function generateRandomNonce(): string {
  // Try to use secure random values, fallback to Math.random if unavailable
  if (window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    console.warn('window.crypto.getRandomValues is unavailable, using Math.random() as fallback for nonce');
    let res = '';
    for (let i = 0; i < 16; i++) {
      res += Math.floor(Math.random() * 16).toString(16);
    }
    return res;
  }
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
