import { join } from 'node:path';

export const PATHS = {
  rawsFolder: join('apps', 'translator', 'test-translation', 'raws'),
  rawsFile: join('apps', 'translator', 'test-translation', 'raw.txt'),
  namesInstructions: join('apps', 'translator', 'instructions', 'NAMES INSTRUCTIONS.md'),
  notesInstructions: join('apps', 'translator', 'instructions', 'NOTES INSTRUCTIONS.md'),
  translatedFolder: join('apps', 'translator', 'test-translation', 'translated'),
  translationInstructions: join(
    'apps',
    'translator',
    'instructions',
    'TRANSLATION INSTRUCTIONS.md',
  ),
  notesFile: join('apps', 'translator', 'test-translation', 'translated', 'op.notes.json'),
  progressFile: join('apps', 'translator', 'test-translation', 'translated', 'op.progress.json'),
} as const;
