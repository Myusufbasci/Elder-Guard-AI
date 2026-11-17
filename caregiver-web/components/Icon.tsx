import type { JSX } from 'react';

/**
 * ElderCare icon set — stroke icons using currentColor.
 * Ported from the Bakıcı Paneli design handoff (icons.jsx) so the web and
 * mobile panels share the same icon language.
 */
export type IconName =
  | 'grid' | 'heart' | 'pulse' | 'sparkles' | 'bell' | 'map' | 'users'
  | 'moon' | 'sun' | 'foot' | 'battery' | 'check' | 'chevronRight'
  | 'download' | 'alert' | 'settings' | 'plus' | 'clock' | 'location'
  | 'phone' | 'logo' | 'refresh' | 'arrowUp' | 'arrowDown' | 'shield'
  | 'logout' | 'trash';

const paths: Record<IconName, JSX.Element> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  heart: <path d="M19 14c1.5-1.6 2-3.3 2-5a4.5 4.5 0 0 0-8-2.8A4.5 4.5 0 0 0 5 9c0 1.7.5 3.4 2 5l5 5z" />,
  pulse: <path d="M3 12h4l2-6 4 12 2.5-7H21" />,
  sparkles: <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.6M21 20c0-2.6-1.5-4.3-4-4.8" /></>,
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  foot: <path d="M7 12c-1.5 0-3 1-3 3.5S5 21 7 21s2.5-1.2 2.5-3c0-1.2.5-2 1.3-2.8.9-.9 1.2-2 .9-3.4C11.3 8.6 9.7 6 7.8 6 6.3 6 5.5 7.3 5.7 9c.2 1.5.8 3 1.3 3z" />,
  battery: <><rect x="2" y="7" width="17" height="10" rx="2" /><path d="M22 10v4" /></>,
  check: <path d="M5 12.5 10 17l9-10" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  download: <><path d="M12 3v12M7 11l5 5 5-5" /><path d="M5 21h14" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 4.3 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.5a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 2.6V2.5a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 17 4.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.4 1z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  location: <><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  phone: <path d="M5 4h3l2 5-2 1.5a11 11 0 0 0 5 5L18 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  logo: <><path d="M12 21s-7-4.5-9.5-9C.8 8.5 2 4.5 6 4c2.3-.3 3.6 1 4.5 2.2C11.4 5 12.7 3.7 15 4c4 .5 5.2 4.5 3.5 8-2.5 4.5-6.5 9-6.5 9z" /><path d="M6 12h3l1.5-3 2 5 1.5-2H18" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  shield: <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />,
  logout: <><path d="M15 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" /><path d="M16 12H9m7 0-3-3m3 3-3 3" /></>,
  trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" /><path d="M10 11v6M14 11v6" /></>,
};

export default function Icon({
  name,
  size = 20,
  stroke = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  );
}
