import { generateId } from 'ai';
import Fuse from 'fuse.js';
import z from 'zod';

// NOTES SCHEMA
const Category = z.enum(['characters', 'places', 'misc']).describe('entry category');

const Note = z.object({
  category: Category,
  id: z.string().describe('16-character random entry unique id'),
  description: z.string().describe('one-line description of the  entry'),
  englishName: z.string().describe('english rendering chosen during translation'),
  sourceName: z.string().describe('name exactly as it appears in the source text'),
});

const NotesDiff = z.object({
  updates: z.array(Note).default([]),
  additions: z.array(Note.omit({ id: true })).default([]),
  deletions: z.array(Note.pick({ category: true, id: true })).default([]),
});

export const Notes = z.intersection(
  z.object({ name: z.string().describe('novel name') }),
  z.record(Category, z.array(Note.omit({ category: true })).default([])),
);

const NameTranslationMap = z
  .array(
    z.object({
      sourceName: z.string().describe('name exactly as it appears in the source text'),
      englishName: z.string().describe('english rendering chosen during translation'),
    }),
  )
  .default([]);

export const NewNamesResponse = z.object({ newNames: NameTranslationMap });

export const NotesDiffResponse = z.object({
  notesChanges: NotesDiff,
});

type Note = z.infer<typeof Note>;
type Category = z.infer<typeof Category>;
type NotesDiff = z.infer<typeof NotesDiff>;
export type Notes = z.infer<typeof Notes>;
export type NameTranslationMap = z.infer<typeof NameTranslationMap>;
export type NotesDiffResponse = z.infer<typeof NotesDiffResponse>;
export type NewNamesResponse = z.infer<typeof NewNamesResponse>;

export function manageNotes(currentNotes: Notes, changes: NotesDiff): Notes {
  const notes: Notes = structuredClone(currentNotes);
  const notesChanges = NotesDiff.parse(changes);

  // Create
  for (const change of notesChanges.additions) {
    const id = generateId();
    const { category, ...restChanges } = change;
    notes[category].push({ id, ...restChanges });
  }

  // Update
  for (const change of notesChanges.updates) {
    const { category, id: _, ...restChanges } = change;
    const index = notes[category].findIndex((note) => note.id === change.id);

    if (index === -1) {
      console.log(`Note with id ${change.id} not found in ${category}`);
      continue;
    }

    notes[category][index] = { ...notes[category][index]!, ...restChanges };
  }

  // Delete
  for (const change of notesChanges.deletions) {
    notes[change.category] = notes[change.category].filter((note) => note.id !== change.id);
  }

  return notes;
}

function normalize(text: string) {
  return text.normalize('NFC').trim();
}

export function filterNotesBySourceText(sourceText: string, notes: Notes): Notes {
  const fuse = new Fuse([{ text: normalize(sourceText) }], {
    keys: ['text'],
    threshold: 0.3,
    ignoreLocation: true,
  });

  const isPresent = (sourceName: string): boolean => {
    return sourceName
      .split('|')
      .map((name) => normalize(name.trim()))
      .filter(Boolean)
      .some((alias) => {
        return fuse.search(alias).length > 0;
      });
  };

  const filterCategory = (category: Category) =>
    notes[category].filter((note) => isPresent(note.sourceName));

  return {
    name: notes.name,
    characters: filterCategory('characters'),
    places: filterCategory('places'),
    misc: filterCategory('misc'),
  };
}

export function filterNamesBySourceText(sourceText: string, notes: Notes): NameTranslationMap {
  const fuse = new Fuse([{ text: normalize(sourceText) }], {
    keys: ['text'],
    threshold: 0.3,
    ignoreLocation: true,
  });

  const isPresent = (sourceName: string): boolean => {
    return sourceName
      .split('|')
      .map((name) => normalize(name.trim()))
      .filter(Boolean)
      .some((alias) => {
        return fuse.search(alias).length > 0;
      });
  };

  const filterCategory = (category: Category) =>
    notes[category].filter((note) => isPresent(note.sourceName));

  return [
    ...filterCategory('characters'),
    ...filterCategory('places'),
    ...filterCategory('misc'),
  ].map((entity) => ({ sourceName: entity.sourceName, englishName: entity.englishName }));
}
