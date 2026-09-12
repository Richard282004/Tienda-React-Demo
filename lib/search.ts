export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Distancia de Levenshtein acotada: para strings cortos de producto basta
// saber si la distancia es <= maxDistance, no el valor exacto.
export function levenshteinWithin(a: string, b: string, maxDistance: number): boolean {
  if (Math.abs(a.length - b.length) > maxDistance) return false;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prevRow = Array.from({ length: cols }, (_, col) => col);
  let currentRow = new Array<number>(cols);
  for (let row = 1; row < rows; row++) {
    currentRow[0] = row;
    for (let col = 1; col < cols; col++) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      currentRow[col] = Math.min(prevRow[col] + 1, currentRow[col - 1] + 1, prevRow[col - 1] + cost);
    }
    prevRow.splice(0, cols, ...currentRow);
  }
  return prevRow[cols - 1] <= maxDistance;
}
