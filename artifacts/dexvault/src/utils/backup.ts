/**
 * Collection Backup Utility
 *
 * Backup file format v1.0:
 * {
 *   version: "1.0",          // bumped if the format ever changes
 *   exportDate: string,       // ISO 8601
 *   cards: BackupCard[]       // one entry per collection_cards row
 * }
 *
 * What IS stored: cardId, quantity, variants, isFavorite, isWishlisted, notes.
 * What is NEVER stored: card_cache, Pokémon API data, images, pricing, sets,
 *   or any other user's data.
 */

import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────

const BACKUP_VERSION = '1.0';

/** One card entry within the backup file. */
export interface BackupCard {
  cardId:       string;
  quantity:     number;
  variants:     Record<string, number>;
  isFavorite:   boolean;
  isWishlisted: boolean;
  notes:        string | null;
}

/** Complete backup file structure. */
export interface CollectionBackup {
  version:    string;
  exportDate: string;
  cards:      BackupCard[];
}

export type ImportMode = 'merge' | 'replace';

// ─── Validation ───────────────────────────────────────────────────────────

/**
 * Validate raw parsed JSON against the backup schema.
 *
 * Checks:
 *   - Top-level is an object with a version field and a cards array.
 *   - Each card has a non-empty cardId string.
 *   - quantity is a number.
 *   - variants is a plain object (if present).
 *   - isFavorite / isWishlisted are booleans (if present).
 *   - notes is a string or null (if present).
 *
 * Throws a user-readable Error on any violation.
 */
function validateBackup(raw: unknown): CollectionBackup {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('File is not a valid JSON object.');
  }
  const d = raw as Record<string, unknown>;

  if (!d.version) {
    throw new Error('Missing required field: version');
  }
  if (!Array.isArray(d.cards)) {
    throw new Error('Missing or invalid field: cards (must be an array)');
  }

  for (let i = 0; i < d.cards.length; i++) {
    const card = d.cards[i];
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw new Error(`cards[${i}] is not an object`);
    }
    const c = card as Record<string, unknown>;

    if (typeof c.cardId !== 'string' || !c.cardId.trim()) {
      throw new Error(`cards[${i}].cardId must be a non-empty string`);
    }
    if (typeof c.quantity !== 'number') {
      throw new Error(`cards[${i}].quantity must be a number`);
    }
    if (
      c.variants !== undefined &&
      (typeof c.variants !== 'object' || Array.isArray(c.variants) || c.variants === null)
    ) {
      throw new Error(`cards[${i}].variants must be a plain object`);
    }
    if (c.isFavorite !== undefined && typeof c.isFavorite !== 'boolean') {
      throw new Error(`cards[${i}].isFavorite must be a boolean`);
    }
    if (c.isWishlisted !== undefined && typeof c.isWishlisted !== 'boolean') {
      throw new Error(`cards[${i}].isWishlisted must be a boolean`);
    }
    if (c.notes !== undefined && c.notes !== null && typeof c.notes !== 'string') {
      throw new Error(`cards[${i}].notes must be a string or null`);
    }
  }

  return d as unknown as CollectionBackup;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Parse and validate a File object as a collection backup.
 * Returns the validated backup or throws with a user-readable error message.
 */
export async function parseBackupFile(file: File): Promise<CollectionBackup> {
  const text = await file.text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  return validateBackup(raw);
}

/**
 * Export the authenticated user's collection to a downloadable JSON file.
 *
 * Only reads collection_cards rows for the given userId — never reads
 * card_cache, pricing data, set data, images, or other users' rows.
 */
export async function exportCollection(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('collection_cards')
    .select('card_id, quantity, variants, is_favorite, is_wishlisted, notes')
    .eq('user_id', userId);

  if (error) {
    toast.error('Export failed', { description: error.message });
    return;
  }

  const cards: BackupCard[] = (data ?? []).map((row) => ({
    cardId:       row.card_id,
    quantity:     row.quantity ?? 0,
    variants:     (row.variants as Record<string, number>) ?? {},
    isFavorite:   row.is_favorite ?? false,
    isWishlisted: row.is_wishlisted ?? false,
    notes:        row.notes ?? null,
  }));

  const backup: CollectionBackup = {
    version:    BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    cards,
  };

  // Trigger browser download
  const blob    = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const anchor  = document.createElement('a');
  anchor.href     = url;
  anchor.download = `pokemon-collection-backup-${dateStr}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  toast.success(`Exported ${cards.length} collection entries.`);
}

/**
 * Import a validated backup into the authenticated user's collection.
 *
 * MERGE mode:
 *   Upserts each card from the backup. Existing records are overwritten
 *   with the imported values. Cards not in the backup are left untouched.
 *
 * REPLACE mode:
 *   Deletes ALL of the user's current collection_cards rows (scoped to
 *   their userId — never touches another user's data), then inserts
 *   every card from the backup. card_cache is never modified.
 *
 * Returns true on success, false on error (toast already shown).
 */
export async function importCollection(
  userId:  string,
  backup:  CollectionBackup,
  mode:    ImportMode
): Promise<boolean> {
  // ── REPLACE: wipe the user's existing collection first ────────────────
  if (mode === 'replace') {
    const { error: delError } = await supabase
      .from('collection_cards')
      .delete()
      .eq('user_id', userId);  // scoped to this user only

    if (delError) {
      toast.error('Import failed — could not clear existing collection', {
        description: delError.message,
      });
      return false;
    }
  }

  // ── Write imported cards ───────────────────────────────────────────────
  // condition is not stored in backups (it's operational state); default it.
  const rows = backup.cards.map((card) => ({
    user_id:      userId,
    card_id:      card.cardId,
    quantity:     card.quantity ?? 0,
    variants:     card.variants ?? {},
    is_favorite:  card.isFavorite ?? false,
    is_wishlisted: card.isWishlisted ?? false,
    notes:        card.notes ?? null,
    condition:    'Near Mint',
  }));

  if (rows.length > 0) {
    // Batch upsert — onConflict handles both insert-new and overwrite-existing.
    const { error: upsertError } = await supabase
      .from('collection_cards')
      .upsert(rows, { onConflict: 'user_id,card_id' });

    if (upsertError) {
      toast.error('Import failed — could not write cards', {
        description: upsertError.message,
      });
      return false;
    }
  }

  toast.success(`Imported ${backup.cards.length} collection entries successfully.`);
  return true;
}
