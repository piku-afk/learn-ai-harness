import { generateId } from 'ai';
import { NotesChanges, type Notes } from './schema.js';

export function manageNotes(currentNotes: Notes, changes: NotesChanges): Notes {
  const notes: Notes = structuredClone(currentNotes);
  const notesChanges = NotesChanges.parse(changes);

  // Create
  for (const change of notesChanges.additions) {
    const id = generateId();
    notes[change.category].push({ id, ...change });
  }

  // Update
  for (const change of notesChanges.updates) {
    const index = notes[change.category].findIndex((note) => note.id === change.id);

    if (index === -1) {
      console.log(`Note with id ${change.id} not found in ${change.category}`);
      continue;
    }

    notes[change.category][index] = { ...notes[change.category][index], ...change };
  }

  // Delete
  for (const change of notesChanges.deletions) {
    notes[change.category] = notes[change.category].filter((note) => note.id !== change.id);
  }

  return notes;
}

