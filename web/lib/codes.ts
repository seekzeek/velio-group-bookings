export function normalizeCode(input: string) {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length === 8 ? cleaned : null;
}

export function displayCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
