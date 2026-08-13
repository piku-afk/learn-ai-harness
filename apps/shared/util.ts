import { access, mkdir } from 'node:fs/promises';

export async function isValidPath(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
  } catch (error) {
    throw Error(`Error: file not found: ${filePath}`, { cause: error });
  }

  return true;
}

export async function ensureFolderExists(folderPath: string): Promise<boolean> {
  try {
    await access(folderPath);
  } catch {
    await mkdir(folderPath, { recursive: true });
  }

  return true;
}
