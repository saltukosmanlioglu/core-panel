import { AdminLayout } from '@/components/layout/admin-layout';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
