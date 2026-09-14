// Implementación de Web Push (VAPID + cifrado aes128gcm, RFC 8291/8292) hecha
// a mano con WebCrypto en vez de la librería npm "web-push": esa librería usa
// crypto.createECDH de Node, que el modo nodejs_compat de Cloudflare Workers
// no soporta. WebCrypto (SubtleCrypto) sí es nativo del runtime del worker,
// así que esta versión corre igual de bien ahí sin depender de compatibilidad
// parcial de Node. El protocolo es el mismo que usan Chrome, Firefox y Safari
// (incluido Safari en iOS 16.4+).

export type PushSubscriptionRecord = { endpoint: string; p256dh: string; auth_key: string };

type VapidKeys = { publicKey: string; privateJwk: JsonWebKey };

function base64urlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

async function importVapidPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function buildVapidJwt(privateKey: CryptoKey, audience: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject };
  const encoder = new TextEncoder();
  const encode = (obj: unknown) => bytesToBase64url(encoder.encode(JSON.stringify(obj)));
  const unsigned = `${encode(header)}.${encode(payload)}`;
  // ECDSA en WebCrypto ya firma en formato "raw" (r||s de 64 bytes), que es
  // justo el formato que pide un JWS ES256 — no hace falta convertir DER.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(unsigned));
  return `${unsigned}.${bytesToBase64url(new Uint8Array(signature))}`;
}

// TS tipa Uint8Array como genérico sobre su ArrayBuffer desde la 5.7, y el
// resultado de operaciones como slice/concat queda con un buffer "ArrayBufferLike"
// que no coincide exactamente con lo que pide BufferSource. Los datos son
// binarios válidos igual; se castea para no arrastrar ese roce de tipos.
function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', asBufferSource(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: asBufferSource(salt), info: asBufferSource(info) }, key, length * 8);
  return new Uint8Array(bits);
}

// Cifra el payload siguiendo aes128gcm (RFC 8188 + RFC 8291): deriva una
// llave y un nonce a partir del secreto ECDH compartido con el navegador y
// del "auth secret" que viene en la suscripción, y arma el registro con el
// header (salt + tamaño + llave pública efímera) seguido del texto cifrado.
async function encryptPayload(payload: Uint8Array, subscription: PushSubscriptionRecord): Promise<Uint8Array> {
  const userPublicKeyRaw = base64urlToBytes(subscription.p256dh);
  const authSecret = base64urlToBytes(subscription.auth_key);

  const appServerKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const appServerPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', appServerKeyPair.publicKey));

  const userPublicKey = await crypto.subtle.importKey('raw', asBufferSource(userPublicKeyRaw), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: userPublicKey }, appServerKeyPair.privateKey, 256));

  const encoder = new TextEncoder();
  const infoPrefix = encoder.encode('WebPush: info\0');
  const keyInfo = concatBytes(infoPrefix, userPublicKeyRaw, appServerPublicRaw);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const cekBytes = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  const cek = await crypto.subtle.importKey('raw', asBufferSource(cekBytes), { name: 'AES-GCM' }, false, ['encrypt']);
  // Delimitador 0x02 = último (y único) registro; sin relleno extra.
  const plaintext = concatBytes(payload, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBufferSource(nonce) }, cek, asBufferSource(plaintext)));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, recordSize, new Uint8Array([appServerPublicRaw.length]), appServerPublicRaw);
  return concatBytes(header, ciphertext);
}

export type PushSendResult = { ok: true } | { ok: false; gone: boolean; status: number };

// Manda una notificación a una suscripción. `gone: true` significa que el
// navegador/dispositivo ya no existe (desinstalada, permiso revocado, etc.) y
// conviene borrar esa fila de push_subscriptions.
export type PushPayload = { title: string; body: string; url?: string; icon?: string };

export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
  vapid: { publicKey: string; privateKeyJwk: string; subject: string },
): Promise<PushSendResult> {
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const privateKey = await importVapidPrivateKey(JSON.parse(vapid.privateKeyJwk) as JsonWebKey);
  const jwt = await buildVapidJwt(privateKey, audience, vapid.subject);
  const body = await encryptPayload(new TextEncoder().encode(JSON.stringify(payload)), subscription);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    },
    body: asBufferSource(body) as BodyInit,
  });
  if (response.ok) return { ok: true };
  return { ok: false, gone: response.status === 404 || response.status === 410, status: response.status };
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{ data: unknown; error: unknown }>;
    delete: () => { eq: (column: string, value: string) => PromiseLike<unknown> };
  };
};

// Manda el aviso de venta nueva a todas las suscripciones guardadas (todas
// las administradoras, todos sus dispositivos). Si Cloudflare no tiene las
// tres variables VAPID configuradas, no hace nada (la venta ya se guardó
// igual; esto es un complemento, como el correo).
export async function notifyAdminSubscribers(
  supabase: SupabaseLike,
  env: { PUSH_VAPID_PUBLIC_KEY?: string; PUSH_VAPID_PRIVATE_KEY_JWK?: string; PUSH_VAPID_SUBJECT?: string },
  payload: PushPayload,
): Promise<void> {
  const { PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY_JWK, PUSH_VAPID_SUBJECT } = env;
  if (!PUSH_VAPID_PUBLIC_KEY || !PUSH_VAPID_PRIVATE_KEY_JWK || !PUSH_VAPID_SUBJECT) return;

  const { data } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key') as {
    data: PushSubscriptionRecord[] | null;
  };
  if (!data?.length) return;

  const vapid = { publicKey: PUSH_VAPID_PUBLIC_KEY, privateKeyJwk: PUSH_VAPID_PRIVATE_KEY_JWK, subject: PUSH_VAPID_SUBJECT };
  await Promise.all(
    data.map(async (subscription) => {
      try {
        const result = await sendWebPush(subscription, payload, vapid);
        if (!result.ok && result.gone) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
      } catch {
        /* Un dispositivo fallando no debe tumbar el aviso a los demás. */
      }
    }),
  );
}

export type { VapidKeys };
