import { type DeletedNotesEntries, type Notes, type NotesEntries } from './schema.js';

export function updateNoteEntries({
  notes,
  notesEntries,
}: {
  notes: Notes;
  notesEntries: NotesEntries;
}): Notes {
  const newNotes = structuredClone(notes);

  let category: keyof NotesEntries;
  for (category in notesEntries) {
    const entriesMap = new Map(newNotes[category].map((entry) => [entry[0], entry]));

    for (const entry of notesEntries[category]) {
      entriesMap.set(entry[0], entry);
    }

    newNotes[category] = [...entriesMap.values()];
  }

  return newNotes;
}

export function deleteNoteEntries({
  notes,
  deletedNotesEntries,
}: {
  notes: Notes;
  deletedNotesEntries: DeletedNotesEntries;
}) {
  const newNotes = structuredClone(notes);

  let category: keyof NotesEntries;
  for (category in deletedNotesEntries) {
    const idsToDelete = new Set(deletedNotesEntries[category]);

    newNotes[category] = newNotes[category].filter(([id]) => !idsToDelete.has(id));
  }

  return newNotes;
}
