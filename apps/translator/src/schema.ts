import z from 'zod';

const Category = z.enum(['characters', 'places', 'misc']).describe('entry category');

const Note = z.object({
  category: Category,
  id: z.string().describe('16-character random entry unique id'),
  description: z.string().describe('one-line description of the  entry'),
  englishName: z.string().describe('character, place, or miscellaneous entry name'),
  sourceName: z
    .string()
    .describe('character, place, or miscellaneous entry name from the source text'),
});

export const NotesChanges = z.object({
  updates: z.array(Note).default([]),
  additions: z.array(Note.omit({ id: true })).default([]),
  deletions: z.array(Note.pick({ category: true, id: true })).default([]),
});

export const ModelResponse = z.object({
  notesChanges: NotesChanges,
  translatedText: z.string().describe('the complete english translated text'),
});

export const Notes = z.intersection(
  z.object({ name: z.string().describe('novel name') }),
  z.record(Category, z.array(Note.omit({ category: true })).default([])),
);

export type Note = z.infer<typeof Note>;
export type Notes = z.infer<typeof Notes>;
export type Category = z.infer<typeof Category>;
export type NotesChanges = z.infer<typeof NotesChanges>;
export type ModelResponse = z.infer<typeof ModelResponse>;
