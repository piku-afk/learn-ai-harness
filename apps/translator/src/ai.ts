import { generateText, Output, type LanguageModel } from 'ai';
import { readFile } from 'node:fs/promises';
import { PATHS } from './constants.js';
import { NotesDiffResponse, NewNamesResponse, Notes, type NameTranslationMap } from './notes.js';

const model: LanguageModel = 'tencent/hy3';

const [namesInstructions, notesInstructions, translationInstructions] = await Promise.all([
  readFile(PATHS.namesInstructions, 'utf8'),
  readFile(PATHS.notesInstructions, 'utf8'),
  readFile(PATHS.translationInstructions, 'utf8'),
]);

export async function getNewNames(params: {
  sourceText: string;
  filteredNames: NameTranslationMap;
}): Promise<NewNamesResponse> {
  const { output } = await generateText({
    model,
    instructions: namesInstructions,
    temperature: 0.3,
    output: Output.object({ schema: NewNamesResponse }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `<names>\n${JSON.stringify(params.filteredNames)}\n</names>\n\n` },
          { type: 'text', text: `<source>\n${params.sourceText}\n</source>` },
        ],
      },
    ],
  });

  return output;
}

export async function translate(params: {
  sourceText: string;
  filteredNames: NameTranslationMap;
}): Promise<string> {
  const { output } = await generateText({
    model,
    instructions: translationInstructions,
    temperature: 0.3,
    reasoning: 'low',
    output: Output.text(),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `<names>\n${JSON.stringify(params.filteredNames)}\n</names>\n\n` },
          { type: 'text', text: `<source>\n${params.sourceText}\n</source>` },
        ],
      },
    ],
  });

  return output;
}

export async function getNotesDiff(params: {
  sourceText: string;
  filteredNotes: Notes;
  newNames: NameTranslationMap;
}): Promise<NotesDiffResponse> {
  const { output } = await generateText({
    model,
    instructions: notesInstructions,
    reasoning: 'low',
    output: Output.object({ schema: NotesDiffResponse }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `<notes>\n${JSON.stringify(params.filteredNotes)}\n</notes>\n\n` },
          {
            type: 'text',
            text: `<new-names>\n${JSON.stringify(params.newNames)}\n</new-names>\n\n`,
          },
          { type: 'text', text: `<source>\n${params.sourceText}\n</source>` },
        ],
      },
    ],
  });

  return output;
}
