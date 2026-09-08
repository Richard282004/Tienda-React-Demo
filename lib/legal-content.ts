// Convierte el texto plano editable desde el admin (líneas "## " = título,
// líneas "- " = ítem de lista, resto = párrafos separados por línea en blanco)
// en bloques listos para renderizar, y reemplaza los placeholders
// {{brandName}} / {{legalName}} / {{phone}} / {{email}} / {{retention}}.

export type LegalBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export function fillLegalPlaceholders(
  text: string,
  vars: { brandName: string; legalName?: string; phone: string; email: string; legalRetention?: string },
): string {
  const legalName = vars.legalName?.trim() || vars.brandName;
  const retention = vars.legalRetention?.trim() || 'Mientras mantengas tu cuenta activa.';
  return text
    .replaceAll('{{brandName}}', vars.brandName)
    .replaceAll('{{legalName}}', legalName)
    .replaceAll('{{phone}}', vars.phone)
    .replaceAll('{{email}}', vars.email)
    .replaceAll('{{retention}}', retention);
}

export function parseLegalBlocks(text: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = text.split('\n');
  let paragraph: string[] = [];
  let listItems: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) { blocks.push({ type: 'p', text: paragraph.join(' ').trim() }); paragraph = []; }
  };
  const flushList = () => {
    if (listItems.length) { blocks.push({ type: 'ul', items: listItems }); listItems = []; }
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    if (line.startsWith('## ')) { flushParagraph(); flushList(); blocks.push({ type: 'h2', text: line.slice(3).trim() }); continue; }
    if (line.startsWith('- ')) { flushParagraph(); listItems.push(line.slice(2).trim()); continue; }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
