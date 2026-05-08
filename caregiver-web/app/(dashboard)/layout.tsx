import Sidebar from '@/components/Sidebar';
import NotificationProvider from '@/components/NotificationProvider';

/**
 * Dashboard layout — Server component.
 * Wraps all authenticated pages with sidebar navigation.
 * Auth guard is handled by middleware.ts (cookie check).
 * NotificationProvider handles FCM foreground toasts.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 lg:p-8">
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </main>
    </div>
  );
}

