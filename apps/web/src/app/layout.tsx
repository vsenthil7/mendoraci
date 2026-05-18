import type { Metadata } from 'next';
import './globals.css';
import { NavLinks } from '../components/NavLinks';

export const metadata: Metadata = {
  title: 'MendoraCI',
  description: 'AI-Powered CI/CD Reliability Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="font-semibold text-slate-900">MendoraCI</div>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
