import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChapterStatus, getChapterStatus, updateProgress } from './progress.js';

const CHAPTER_NAME_REGEX = /(?=\d+화\.)/;
const CHAPTER_NUMBER_REGEX = /^(\d+)화\./;

export async function getChapterEntries(rawsFolder: string) {
  const entries = await readdir(rawsFolder, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export async function extractChapters({
  rawsFile,
  outputDir,
  progressFile,
}: {
  rawsFile: string;
  outputDir: string;
  progressFile: string;
}): Promise<void> {
  const rawText = await readFile(rawsFile, 'utf8');
  const chapters = rawText.split(CHAPTER_NAME_REGEX).filter((s) => s.trim().length > 0);

  for (const chapter of chapters) {
    const match = chapter.match(CHAPTER_NUMBER_REGEX);

    if (match === null) {
      console.log('Could not find chapter number, skipping');
      continue;
    }

    const chapterName = `Chapter${match[1]}`;
    const status = await getChapterStatus(progressFile, chapterName);

    if (status === ChapterStatus.enum.success) {
      console.log(`${chapterName} had been already successfully translated, skipping`);
    }

    const filename = join(outputDir, `${chapterName}.txt`);
    await writeFile(filename, chapter.trim(), 'utf8');
    await updateProgress(progressFile, {
      chapterId: chapterName,
      status: ChapterStatus.enum.pending,
    });
  }
}
