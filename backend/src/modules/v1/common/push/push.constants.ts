/**
 * Firebase DI injection tokens.
 * Extracted to a separate file to break circular imports between
 * push.module.ts ↔ push.service.ts (CommonJS circular reference).
 */
export const FIREBASE_APP = 'FIREBASE_APP';
export const FIREBASE_MESSAGING = 'FIREBASE_MESSAGING';
