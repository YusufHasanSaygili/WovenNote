export function normalizeTurkishSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/\s+/gu, ' ').trim()
}
