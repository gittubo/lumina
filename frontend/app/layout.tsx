import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LUMINA - AI Creative Platform',
  description: 'Next-Generation AI Creative Platform for generating images, videos, and 3D content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}