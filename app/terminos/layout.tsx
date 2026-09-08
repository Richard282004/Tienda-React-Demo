import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de compra, envío, cambios y devoluciones.',
};

export default function TerminosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
