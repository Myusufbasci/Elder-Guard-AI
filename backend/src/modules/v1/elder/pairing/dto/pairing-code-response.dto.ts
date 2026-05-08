// Returned by POST /v1/caregiver/elders. The caregiver UI renders the code
// (and `pairingToken` inside a QR) for the elder to scan / type into Android.
export interface PairingCodeResponse {
  code: string;             // 6-digit numeric, single-use, 15-min TTL
  pairingToken: string;     // DEVICE_PAIRING JWT carrying sub = elder.userId
  expiresAt: string;        // ISO 8601
  elderId: string;          // UUID of the freshly created ElderProfile.userId
}
