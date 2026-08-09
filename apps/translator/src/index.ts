import { gateway, generateText, Output } from 'ai';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ensurePathExists, isValidPath } from '../../shared/util.js';
import { deleteNoteEntries, updateNoteEntries } from './notes.js';
import { ModelResponseSchema, NotesSchema } from './schema.js';

if (process.env.NODE_ENV === 'development') {
  const { DevToolsTelemetry } = await import('@ai-sdk/devtools');
  const { registerTelemetry } = await import('ai');

  registerTelemetry(DevToolsTelemetry());
}

const instructions = await readFile(join('apps', 'translator', 'SYSTEM INSTRUCTIONS.md'), 'utf8');

async function translate({
  inputFile,
  outputFile,
  notesFile,
}: {
  inputFile: string;
  outputFile: string;
  notesFile: string;
}) {
  isValidPath(inputFile);
  isValidPath(notesFile);
  ensurePathExists(outputFile); // create the output file if it does not exists

  const [notesContent, sourceText] = await Promise.all([
    readFile(notesFile, 'utf8'),
    readFile(inputFile, 'utf8'),
  ]);

  const notes = NotesSchema.parse(JSON.parse(notesContent));

  const {
    output: { translatedText, notesEntries, deletedNotesEntries },
  } = await generateText({
    model: 'tencent/hy3',
    instructions,
    temperature: 0.1,
    reasoning: 'none',
    output: Output.object({ schema: ModelResponseSchema }),
    maxOutputTokens: 10_000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `<notes>\n${JSON.stringify(notes)}\n</notes>\n\n` },
          { type: 'text', text: `<source>\n${sourceText}\n</source>` },
        ],
      },
    ],
  });

  // write translated text to output file
  await writeFile(outputFile, translatedText, 'utf8');

  // update and write notes
  const updatedNotes = updateNoteEntries({ notes, notesEntries });
  const deletedNotes = deleteNoteEntries({ notes: updatedNotes, deletedNotesEntries });
  await writeFile(notesFile, JSON.stringify(deletedNotes, null, 2), 'utf8');
}

const rawsFolderPath = join('apps', 'translator', 'test-translation', 'raws');
const outputFolderPath = join('apps', 'translator', 'test-translation', 'translated');
const rawFile = join('apps', 'translator', 'test-translation', 'raw.txt');
const notesFile = join('apps', 'translator', 'test-translation', 'translated', 'op.notes.json');

// extract chapters;
const rawText = await readFile(rawFile, 'utf8');
const chapters = rawText.split(/(?=\d+화\.)/).filter((s) => s.trim().length > 0);

for (const chapter of chapters) {
  const match = chapter.match(/^(\d+)화\./);

  if (!match) {
    console.warn('Could not find chapter number, skipping');
    continue;
  }
  const num = match[1];
  const chapterName = `Chapter${num}.txt`;
  const filename = join(rawsFolderPath, chapterName);
  await writeFile(filename, chapter.trim(), 'utf8');
  console.log(chapterName, 'extracted');
}

const preCredits = await gateway.getCredits();
const entries = (await readdir(rawsFolderPath, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

for (const entry of entries) {
  const inputFile = join(rawsFolderPath, entry.name);
  const outputFile = join(outputFolderPath, entry.name.replace(/\.txt$/, '.md'));

  await translate({ inputFile, outputFile, notesFile });
  console.log(entry.name, 'translated');
}

const postCredit = await gateway.getCredits();
console.log('Total credits used: ', Number(preCredits.balance) - Number(postCredit.balance));
