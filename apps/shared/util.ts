import fs from 'node:fs/promises';

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
    await fs.access(filePath);
  } catch (error) {
    try {
      await fs.writeFile(filePath, '', 'utf8');
    } catch (createError) {
      throw new Error(`Failed to create file: ${filePath}`, { cause: createError });
    }
  }

  return true;
}
