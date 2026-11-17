'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import Icon, { type IconName } from '@/components/Icon';

const NAV: { href: string; icon: IconName; label: string; exact?: boolean }[] = [
  { href: '/elders', icon: 'users', label: 'Yaşlılar', exact: true },
  { href: '/alerts', icon: 'bell', label: 'Uyarılar' },
  { href: '/elders/pair', icon: 'plus', label: 'Yaşlı Ekle' },
  { href: '/settings', icon: 'settings', label: 'Ayarlar' },
];

function pageMeta(pathname: string): { title: string; sub: string } {
  if (pathname === '/elders') return { title: 'Yaşlılar', sub: 'Bakımını üstlendiğiniz kişiler' };
  if (pathname === '/elders/pair') return { title: 'Yaşlı Ekle', sub: 'Yeni cihaz eşleştir' };
  if (pathname.includes('/vitals')) return { title: 'Vital Grafikleri', sub: 'Dönemsel vital analizi' };
  if (pathname.startsWith('/elders/')) return { title: 'Yaşlı Detayı', sub: 'Sağlık durumu ve canlı veriler' };
  if (pathname.startsWith('/alerts')) return { title: 'Uyarılar', sub: 'Anomali tespit ve uyarı yönetimi' };
  if (pathname.startsWith('/settings')) return { title: 'Ayarlar', sub: 'Hesap ve bildirim tercihleri' };
  return { title: 'ElderCare', sub: 'Bakıcı Paneli' };
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [pathname]);

  const isDark = (resolvedTheme ?? theme) === 'dark';
  const { title, sub } = pageMeta(pathname);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="ec-shell">
      <aside className={'ec-sidebar' + (navOpen ? ' open' : '')}>
        <div className="ec-brand">
          <span className="ec-logo"><Icon name="logo" size={22} /></span>
          <div>
            <div className="ec-brand-name">ElderCare</div>
            <div className="ec-brand-sub">Bakıcı Paneli</div>
          </div>
        </div>

        <nav className="ec-nav">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                id={`nav-${n.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={'ec-nav-item' + (active ? ' active' : '')}
              >
                <Icon name={n.icon} size={19} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ec-sidebar-foot">
          <div className="ec-caregiver">
            <span
              className="grid place-items-center rounded-full font-semibold"
              style={{ width: 36, height: 36, background: 'var(--avatar-bg)', color: 'var(--ec-accent-deep)', fontSize: 13 }}
            >
              SY
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text-1)] truncate">Bakıcı</div>
              <div className="text-[11.5px] text-[var(--text-3)]">Hesabım</div>
            </div>
            <button className="ec-icon-btn" title="Çıkış yap" aria-label="Çıkış yap" onClick={handleLogout}>
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {navOpen && <div className="ec-scrim" onClick={() => setNavOpen(false)} />}

      <main className="ec-main">
        <header className="ec-topbar">
          <button className="ec-icon-btn ec-burger" onClick={() => setNavOpen(true)} aria-label="Menüyü aç">
            <Icon name="grid" size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="ec-page-title">{title}</h1>
            <p className="ec-page-sub">{sub}</p>
          </div>
          <button
            className="ec-icon-btn"
            title="Tema değiştir"
            aria-label="Tema değiştir"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {mounted ? <Icon name={isDark ? 'sun' : 'moon'} size={19} /> : <Icon name="moon" size={19} />}
          </button>
          <Link href="/alerts" className="ec-icon-btn ec-bell-btn" title="Uyarılar" aria-label="Uyarılar">
            <Icon name="bell" size={19} />
          </Link>
        </header>

        <div className="ec-content">{children}</div>
      </main>
    </div>
  );
}
