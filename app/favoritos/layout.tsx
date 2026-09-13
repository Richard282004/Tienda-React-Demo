import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tus favoritos',
  robots: { index: false, follow: true },
};

export default function FavoritosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
