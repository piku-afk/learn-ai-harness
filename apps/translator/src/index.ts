import { DevToolsTelemetry } from '@ai-sdk/devtools';
import { gateway, generateText, registerTelemetry, Output, type LanguageModel } from 'ai';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { ensureFolderExists, isValidPath } from '../../shared/util.js';
import { extractChapters, getChapterEntries } from './chapters.js';
import { filterNotesBySourceText, manageNotes, type NameMap } from './notes.js';
import { TranslationResponse, NotesDiffResponse, Notes } from './notes.js';
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

const model: LanguageModel = 'tencent/hy3';

const PATHS = {
  rawsFolder: join('apps', 'translator', 'test-translation', 'raws'),
  rawsFile: join('apps', 'translator', 'test-translation', 'raw.txt'),
  notesInstructions: join('apps', 'translator', 'NOTES INSTRUCTIONS.md'),
  translatedFolder: join('apps', 'translator', 'test-translation', 'translated'),
  translationInstructions: join('apps', 'translator', 'TRANSLATION INSTRUCTIONS.md'),
  notesFile: join('apps', 'translator', 'test-translation', 'translated', 'op.notes.json'),
  progressFile: join('apps', 'translator', 'test-translation', 'translated', 'op.progress.json'),
} as const;

async function handleError(error: unknown, chapterName: string) {
  await updateProgress(PATHS.progressFile, {
    chapterId: chapterName,
    status: ChapterStatus.enum.failed,
    error: String(error),
  });
  throw new Error(`${chapterName} failed`, { cause: error });
}

async function main() {
  await extractChapters({
    rawsFile: PATHS.rawsFile,
    outputDir: PATHS.rawsFolder,
    progressFile: PATHS.progressFile,
  });

  const [notesInstructions, translationInstructions] = await Promise.all([
    readFile(PATHS.notesInstructions, 'utf8'),
    readFile(PATHS.translationInstructions, 'utf8'),
  ]);

  const entries = await getChapterEntries(PATHS.rawsFolder);

  for (const entry of entries) {
    let newNames: NameMap = [];
    const chapterName = entry.name.replace('.txt', '');

    if ((await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.success) {
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

    if ((await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.pending) {
      try {
        const { output } = await generateText({
          model,
          instructions: translationInstructions,
          temperature: 0.3,
          reasoning: 'low',
          output: Output.object({ schema: TranslationResponse }),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `<notes>\n${JSON.stringify(filteredNotes)}\n</notes>\n\n` },
                { type: 'text', text: `<source>\n${sourceText}\n</source>` },
              ],
            },
          ],
        });

        newNames = output.newNames;
        await writeFile(outputFile, output.translatedText, 'utf8');
        await updateProgress(PATHS.progressFile, {
          chapterId: chapterName,
          status: ChapterStatus.enum.syncing,
        });
      } catch (error) {
        await handleError(error, chapterName);
      }
    }

    if ((await getChapterStatus(PATHS.progressFile, chapterName)) === ChapterStatus.enum.syncing) {
      try {
        const {
          output: { notesChanges },
        } = await generateText({
          model,
          instructions: notesInstructions,
          reasoning: 'none',
          output: Output.object({ schema: NotesDiffResponse }),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `<notes>\n${JSON.stringify(filteredNotes)}\n</notes>\n\n` },
                {
                  type: 'text',
                  text: `<new-names>\n${JSON.stringify(newNames)}\n</new-names>\n\n`,
                },
                { type: 'text', text: `<source>\n${sourceText}\n</source>` },
              ],
            },
          ],
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
}

const preCredits = await gateway.getCredits();
try {
  await main();
} finally {
  const postCredit = await gateway.getCredits();
  console.log('Total credits used: ', Number(preCredits.balance) - Number(postCredit.balance));
}
