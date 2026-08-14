import { dirname, join } from 'node:path';
import { gateway, registerTelemetry } from 'ai';
import { DevToolsTelemetry } from '@ai-sdk/devtools';
import { readFile, writeFile } from 'node:fs/promises';

import { Notes } from './notes.js';
import { PATHS } from './constants.js';
import { getNotesDiff, translate } from './ai.js';
import { extractChapters, getChapterEntries } from './chapters.js';
import { ensureFolderExists, isValidPath } from '../../shared/util.js';
import { filterNotesBySourceText, manageNotes, type NameMap } from './notes.js';
import { ChapterStatus, getChapterStatus, updateProgress } from './progress.js';

if (process.env.NODE_ENV === 'development') {
  registerTelemetry(DevToolsTelemetry());
}

// Application entry point for the translation workflow.
//
// The workflow is orchestrated in the following order:
// 1. Read the raw source text and extract individual chapters using `chapters`.
// 2. Write the extracted chapters to the raw chapters directory.
// 3. Read the extracted chapter files and translate them using `translator`.
// 4. Apply the model's note changes using `notes`.
// 5. Write the translated chapter and updated notes to the output directory.
// 6. Track and report the total AI credits consumed during the workflow.
//
// `index.ts` is responsible only for coordinating these modules and managing
// the overall workflow; the individual modules contain the implementation
// details for each step.

async function handleError(error: unknown, chapterName: string) {
  await updateProgress(PATHS.progressFile, {
    chapterId: chapterName,
    status: ChapterStatus.enum.failed,
    error: String(error),
  });
  throw new Error(`${chapterName} failed`, { cause: error });
}

async function main() {
  const preCredits = await gateway.getCredits();

  try {
    await extractChapters({
      rawsFile: PATHS.rawsFile,
      outputDir: PATHS.rawsFolder,
      progressFile: PATHS.progressFile,
    });

    const entries = await getChapterEntries(PATHS.rawsFolder);

    for (const entry of entries) {
      let newNames: NameMap = [];
      const chapterName = entry.name.replace('.txt', '');

      if (
        (await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.success
      ) {
        continue;
      } else if (
        (await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.failed
      ) {
        await updateProgress(PATHS.progressFile, {
          chapterId: chapterName,
          status: ChapterStatus.enum.pending,
        });
      }

      const inputFile = join(PATHS.rawsFolder, entry.name);
      const outputFile = join(PATHS.translatedFolder, `${chapterName}.md`);

      isValidPath(inputFile);
      isValidPath(PATHS.notesFile);
      await ensureFolderExists(dirname(outputFile)); // create the output folder if it does not exists

      const [notesContent, sourceText] = await Promise.all([
        readFile(PATHS.notesFile, 'utf8'),
        readFile(inputFile, 'utf8'),
      ]);

      const notes = Notes.parse(JSON.parse(notesContent));
      const filteredNotes = filterNotesBySourceText(sourceText, notes);

      if (
        (await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.pending
      ) {
        try {
          const translationOutput = await translate({
            sourceText,
            filteredNotes: JSON.stringify(filteredNotes),
          });
          newNames = translationOutput.newNames;
          await writeFile(outputFile, translationOutput.translatedText, 'utf8');
          await updateProgress(PATHS.progressFile, {
            chapterId: chapterName,
            status: ChapterStatus.enum.syncing,
          });
        } catch (error) {
          await handleError(error, chapterName);
        }
      }

      if (
        (await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.syncing
      ) {
        try {
          const { notesChanges } = await getNotesDiff({
            sourceText,
            newNames: JSON.stringify(newNames),
            filteredNotes: JSON.stringify(filteredNotes),
          });
          const updatedNotes = manageNotes(notes, notesChanges);
          await writeFile(PATHS.notesFile, JSON.stringify(updatedNotes, null, 2), 'utf8');
          await updateProgress(PATHS.progressFile, {
            chapterId: chapterName,
            status: ChapterStatus.enum.success,
          });
        } catch (error) {
          await handleError(error, chapterName);
        }
      }

      console.log(`${chapterName} has been translated successfully`);
    }
  } finally {
    const postCredit = await gateway.getCredits();
    console.log('Total credits used: ', Number(preCredits.balance) - Number(postCredit.balance));
  }
}

main();
