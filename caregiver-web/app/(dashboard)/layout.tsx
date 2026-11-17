import DashboardShell from '@/components/DashboardShell';
import NotificationProvider from '@/components/NotificationProvider';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';

/**
 * Dashboard layout — Server component.
 * DashboardShell renders the sidebar + topbar design signature; auth guard is
 * handled by middleware.ts (cookie check). NotificationProvider handles FCM
 * foreground toasts.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      <NotificationProvider>
        <VerifyEmailBanner />
        {children}
      </NotificationProvider>
    </DashboardShell>
  );
}
