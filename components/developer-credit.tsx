import { safeExternalUrl } from '@/lib/home-content';
import type { StoreContent } from '@/lib/store-data';

// Crédito discreto al final de la portada y las fichas de producto. Texto,
// nombre, enlace y visibilidad se editan en Admin → Página principal.
export function DeveloperCredit({ content }: { content: Pick<StoreContent, 'devCreditEnabled' | 'devCreditText' | 'devCreditName' | 'devCreditUrl'> }) {
  const name = content.devCreditName?.trim();
  if (content.devCreditEnabled === false || !name) return null;
  const text = content.devCreditText?.trim();
  const href = safeExternalUrl(content.devCreditUrl);
  return (
    <p className="developer-credit page-width">
      {text && <>{text}{' '}</>}
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {name}<span className="sr-only"> (abre en otra pestaña)</span>
        </a>
      ) : <span>{name}</span>}
    </p>
  );
}
