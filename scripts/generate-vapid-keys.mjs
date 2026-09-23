// Genera el par de llaves VAPID para Web Push. Se corre una sola vez (local,
// nunca en el worker) con: node scripts/generate-vapid-keys.mjs
// Los tres valores que imprime van como Cloudflare Workers Secrets (mismo
// lugar donde está BREVO_API_KEY, MP_ACCESS_TOKEN, etc.), no en el repo.

function bytesToBase64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return Buffer.from(binary, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

console.log('PUSH_VAPID_PUBLIC_KEY=' + bytesToBase64url(publicRaw));
console.log('PUSH_VAPID_PRIVATE_KEY_JWK=' + JSON.stringify(privateJwk));
console.log('PUSH_VAPID_SUBJECT=mailto:contacto@tutienda.cl');
