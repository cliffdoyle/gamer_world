import React from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-gray-900`}>
        <Providers>
          <Header />
          <main>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
