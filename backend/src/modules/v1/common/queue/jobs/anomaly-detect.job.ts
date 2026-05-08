// Payload contract for ANOMALY_DETECT jobs.
// Producer: TelemetryService (after a successful batch ingest, deduped by metric).
// Consumer: AnomalyDetectorProcessor (computes Modified Z-Score over telemetry_1m).
//
// `elderId` is resolved from the JWT at enqueue time so the worker does not
// have to re-derive ownership from `deviceId`.

export interface AnomalyDetectJobData {
  deviceId: string;
  elderId: string;
  metric: string;
}

export const ANOMALY_DETECT_JOB = 'detect';
