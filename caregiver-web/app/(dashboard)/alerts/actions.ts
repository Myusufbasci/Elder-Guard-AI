'use server';

import { apiPost } from '@/lib/api';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: acknowledge an alert by ID.
 * Calls POST /v1/caregiver/alerts/:id/ack via the server-side API client.
 */
export async function acknowledgeAlert(alertId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPost<{ id: string; acknowledged: boolean }>(`/v1/caregiver/alerts/${alertId}/ack`, {});
    revalidatePath('/alerts');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to acknowledge alert' };
  }
}
