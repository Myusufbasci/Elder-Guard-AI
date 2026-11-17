import Link from 'next/link';
import { Suspense } from 'react';
import { apiFetch } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/Icon';
import DeleteElderButton from './DeleteElderButton';
import EldersListSync from './EldersListSync';

/**
 * Elder list page — Server component.
 * Fetches linked elders from NestJS API via cookie-based auth.
 */

interface Elder {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  linkedAt: string;
  status?: 'stable' | 'needs_attention' | 'critical' | 'unknown';
}

export const metadata = {
  title: 'Elders — ElderCare Dashboard',
};

export default async function EldersPage() {
  let elders: Elder[] = [];
  let error = '';

  try {
    elders = await apiFetch<Elder[]>('/v1/caregiver/elders');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load elders';
  }

  return (
    <div>
      {/* Live sync: unpair notice + periodic refresh */}
      <Suspense fallback={null}>
        <EldersListSync />
      </Suspense>

      {/* Action row (topbar already shows the section title) */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-surface-400">
          {elders.length} kişi · 1 bakıcı hesabı
        </p>
        <Link href="/elders/pair" id="add-elder-button" className="ec-primary-btn">
          <Icon name="plus" size={16} />
          Yaşlı Ekle
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-5 py-4 text-danger-400 mb-6">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && elders.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-surface-800 flex items-center justify-center text-surface-500 mb-5">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-200 mb-2">Henüz yaşlı eklenmemiş</h2>
          <p className="text-surface-400 mb-6">Takibe başlamak için bir yaşlının cihazını eşleştirin.</p>
          <Link
            href="/elders/pair"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-500/15 text-accent-400 font-medium hover:bg-accent-500/25 transition-all"
          >
            <Icon name="plus" size={18} />
            Yaşlı Eşleştir
          </Link>
        </div>
      )}

      {/* Elder cards grid */}
      {elders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {elders.map((elder) => (
            <Link
              key={elder.id}
              href={`/elders/${elder.id}`}
              id={`elder-card-${elder.id}`}
              className="group rounded-2xl bg-surface-900 border border-surface-800 p-5 card-hover relative"
            >
              <div className="absolute top-3 right-3">
                <DeleteElderButton elderId={elder.id} elderName={`${elder.firstName} ${elder.lastName}`} />
              </div>
              <div className="flex items-start justify-between mb-4 pr-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400/20 to-accent-600/20 flex items-center justify-center text-accent-400 font-semibold text-lg">
                    {elder.firstName.charAt(0)}{elder.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-50 group-hover:text-accent-400 transition-colors">
                      {elder.firstName} {elder.lastName}
                    </h3>
                    <p className="text-xs text-surface-500">
                      Eşleşti · {new Date(elder.linkedAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
                <StatusBadge status={elder.status ?? 'unknown'} />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-500">
                  Doğum · {new Date(elder.dateOfBirth).toLocaleDateString('tr-TR')}
                </span>
                <span className="text-accent-400 text-xs font-medium group-hover:translate-x-1 transition-transform">
                  Detayları gör →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
