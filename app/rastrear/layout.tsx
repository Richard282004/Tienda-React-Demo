import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rastrear mi pedido',
  description: 'Consulta el estado de tu pedido con tu correo y número de orden.',
};

export default function RastrearLayout({ children }: { children: React.ReactNode }) {
  return children;
}
