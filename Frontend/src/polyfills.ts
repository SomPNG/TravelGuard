import { Buffer } from 'buffer';

// @ts-ignore
window.global = window;
// @ts-ignore
window.Buffer = Buffer;

// Polyfill globalThis.crypto so @noble/ciphers (used by @perawallet/connect)
// can access crypto.subtle. Browsers only expose crypto.subtle on secure
// contexts (HTTPS / localhost). This ensures it is always wired up.
if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore
  globalThis.crypto = window.crypto;
} else if (typeof globalThis.crypto.subtle === 'undefined') {
  // @ts-ignore
  globalThis.crypto = window.crypto;
}
