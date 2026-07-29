const RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

export function hasReservedWindowsFilename(path: string): boolean {
  const parts = path.replace(/\\/g, '/').split('/');
  for (const part of parts) {
    const name = part.split('.')[0].toUpperCase();
    if (RESERVED_NAMES.has(name)) return true;
  }
  return false;
}

export function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

export function isCaseInsensitivePathEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
