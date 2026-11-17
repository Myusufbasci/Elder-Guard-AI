'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function deleteElderAction(elderId: string): Promise<void> {
  await apiFetch<void>(`/v1/caregiver/elders/${elderId}`, { method: 'DELETE' });
  revalidatePath('/elders');
}
