import type { Metadata } from 'next';
import { ThemeProvider } from '@/theme/theme-provider';
import { UserProvider } from '@/contexts/UserContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'CompanyName — Secure Access',
  description: 'Secure access to your workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <UserProvider>{children}</UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
