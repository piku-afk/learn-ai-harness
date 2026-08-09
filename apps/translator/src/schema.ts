import z from 'zod';

export const CategorySchema = z.enum(['characters', 'places', 'misc']).describe('entry category');
export const NotesEntriesSchema = z.record(
  CategorySchema,
  z.array(
    z.tuple([
      z.number().describe('entry unique id'),
      z.string().describe('character, place, or miscellaneous entry name from the source text'),
      z.string().describe('character, place, or miscellaneous entry name'),
      z.string().describe('one-line description of the  entry'),
    ]),
  ),
);
export const DeletedNotesEntriesSchema = z.record(
  CategorySchema,
  z.array(z.number().describe('entry id to be deleted')),
);
export const NotesSchema = z.intersection(z.object({ name: z.string() }), NotesEntriesSchema);
export const ModelResponseSchema = z.object({
  translatedText: z.string().describe('the complete english translated text'),
  notesEntries: NotesEntriesSchema,
  deletedNotesEntries: DeletedNotesEntriesSchema,
});

export type Notes = z.infer<typeof NotesSchema>;
export type NotesEntries = z.infer<typeof NotesEntriesSchema>;
export type DeletedNotesEntries = z.infer<typeof DeletedNotesEntriesSchema>;
