// Returned by POST /v1/caregiver/elders. NOTE: no elder is created at this point —
// the elder is persisted only when this code is redeemed on the elder device.
export interface PairingCodeResponse {
  code: string; // 6-digit numeric, single-use, 15-min TTL
  expiresAt: string; // ISO 8601
}
