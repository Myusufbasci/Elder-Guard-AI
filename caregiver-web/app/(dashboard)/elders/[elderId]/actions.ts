'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';

/**
 * On-demand AI summary generation for an elder. Calls the caregiver-scoped
 * backend trigger (CareLinkGuard enforces ownership), then revalidates the
 * detail route so the freshly written summary is re-fetched.
 */
export async function regenerateSummaryAction(elderId: string): Promise<void> {
  await apiPost<{ message: string }>(
    `/v1/caregiver/elders/${elderId}/summary/regenerate`,
    {},
  );
  revalidatePath(`/elders/${elderId}`);
}
