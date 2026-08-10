import { generateId } from 'ai';
import Fuse from 'fuse.js';

import { NotesChanges, type Category, type Notes } from './schema.js';

export function manageNotes(currentNotes: Notes, changes: NotesChanges): Notes {
  const notes: Notes = structuredClone(currentNotes);
  const notesChanges = NotesChanges.parse(changes);

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

