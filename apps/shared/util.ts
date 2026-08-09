import fs from 'node:fs/promises';
import { dirname } from 'node:path';

export async function isValidPath(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw Error(`Error: file not found: ${filePath}`, { cause: error });
  }

  return true;
}

export async function ensurePathExists(filePath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '', { encoding: 'utf8', flag: 'a' });
  } catch (error) {
    throw new Error(`Failed to create file: ${filePath}`, { cause: error });
  }

  return true;
}
