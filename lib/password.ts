// The Sites runtime currently accepts at most 100,000 PBKDF2 iterations.
const PASSWORD_HASH_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  return Uint8Array.from(hex.match(/.{1,2}/g) ?? [], (part) => Number.parseInt(part, 16));
}

function randomHex(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function createPasswordHash(password: string) {
  const salt = randomHex(16);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
    256,
  );
  return `${salt}:${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: "SHA-256",
    },
    await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]),
    256,
  );
  const actual = bytesToHex(new Uint8Array(bits));
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i += 1) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
