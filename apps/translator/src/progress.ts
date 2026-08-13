import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

// PROGRESS SCHEMA
export const ChapterStatus = z.enum(['pending', 'syncing', 'success', 'failed']);
export const ChapterProgress = z.array(
  z.object({
    chapterId: z.string(),
    status: ChapterStatus,
    error: z.string().optional(),
  }),
);

export type ChapterProgress = z.infer<typeof ChapterProgress>;

async function readProgress(filePath: string): Promise<ChapterProgress> {
  const raw = await readFile(filePath, 'utf8');
  return ChapterProgress.parse(JSON.parse(raw));
}

async function writeProgress(filePath: string, progress: ChapterProgress): Promise<void> {
  await writeFile(filePath, JSON.stringify(progress), 'utf8');
}

export async function getChapterStatus(progressFilePath: string, chapterId: string) {
  const progress = await readProgress(progressFilePath);
  return progress.find((c) => c.chapterId === chapterId)?.status ?? 'pending';
}

export async function updateProgress(
  filePath: string,
  update: ChapterProgress[number],
): Promise<void> {
  const currentProgress = await readProgress(filePath);
  const existing = currentProgress.find((c) => c.chapterId === update.chapterId);

  const progress = (
    existing
      ? currentProgress.map((chapter) =>
          chapter.chapterId === update.chapterId ? { ...chapter, ...update } : chapter,
        )
      : [...currentProgress, { ...update }]
  ) satisfies ChapterProgress;

  await writeProgress(filePath, progress);
}
