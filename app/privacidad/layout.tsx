import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Cómo recopilamos, usamos y protegemos tus datos personales.',
};

export default function PrivacidadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
