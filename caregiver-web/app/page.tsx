import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth';

/**
 * Root page: redirects authenticated users to /elders, unauthenticated to /login.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    redirect('/elders');
  } else {
    redirect('/login');
  }
}
