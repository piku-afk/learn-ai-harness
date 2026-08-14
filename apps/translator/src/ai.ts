import { generateText, Output, type LanguageModel } from 'ai';
import { readFile } from 'node:fs/promises';
import { PATHS } from './constants.js';
import { NotesDiffResponse, TranslationResponse } from './notes.js';

const model: LanguageModel = 'tencent/hy3';

const [notesInstructions, translationInstructions] = await Promise.all([
  readFile(PATHS.notesInstructions, 'utf8'),
  readFile(PATHS.translationInstructions, 'utf8'),
]);

export async function translate(params: {
  sourceText: string;
  filteredNotes: string;
}): Promise<TranslationResponse> {
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
          { type: 'text', text: `<notes>\n${params.filteredNotes}\n</notes>\n\n` },
          { type: 'text', text: `<source>\n${params.sourceText}\n</source>` },
        ],
      },
    ],
  });

  return output;
}

export async function getNotesDiff(params: {
  newNames: string;
  sourceText: string;
  filteredNotes: string;
}): Promise<NotesDiffResponse> {
  const { output } = await generateText({
    model,
    instructions: notesInstructions,
    reasoning: 'none',
    output: Output.object({ schema: NotesDiffResponse }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `<notes>\n${params.filteredNotes}\n</notes>\n\n` },
          { type: 'text', text: `<new-names>\n${params.newNames}\n</new-names>\n\n` },
          { type: 'text', text: `<source>\n${params.sourceText}\n</source>` },
        ],
      },
    ],
  });

  return output;
}
