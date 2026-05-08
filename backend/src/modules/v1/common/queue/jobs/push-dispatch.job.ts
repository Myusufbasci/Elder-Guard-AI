// Payload contract for PUSH_DISPATCH jobs.
// Producer: AnomalyService (after persisting an AnomalyEvent).
// Consumer: PushDispatchProcessor (Step 4 — FCM multicast).

export interface PushDispatchJobData {
  anomalyEventId: string;
}

export const PUSH_DISPATCH_JOB = 'dispatch';
