import {mkdir, rename, rm} from 'node:fs/promises'
import path from 'node:path'

export type PendingRename = {
  finalPath: string
  tmpPath: string
}

// Renames each entry in order (creating the final path's parent directory first, since a
// leaf-directory rename's destination directory may not exist yet — e.g. `.cursor/skills/` on a
// workspace that never had Cursor content before). If any rename fails, every rename that already
// succeeded is rolled back (removed, in reverse order) before the error is re-thrown, so the
// whole batch either fully lands or leaves nothing behind. Callers decide ordering: put the entry
// whose presence should imply "everything else landed too" last (e.g. `registry.json`).
// Each rename MUST happen strictly after the previous one lands — that ordering is the entire
// point (a caller relies on "entry N present implies entries before it landed too") — so these
// awaits cannot be parallelized with Promise.all.
/* eslint-disable no-await-in-loop */
export async function renameAllOrNothing(renames: PendingRename[]): Promise<void> {
  const completed: string[] = []

  try {
    for (const {finalPath, tmpPath} of renames) {
      await mkdir(path.dirname(finalPath), {recursive: true})
      await rename(tmpPath, finalPath)
      completed.push(finalPath)
    }
  } catch (error) {
    for (const finalPath of completed.reverse()) {
      await rm(finalPath, {force: true, recursive: true}).catch(() => {})
    }

    throw error
  }
}
/* eslint-enable no-await-in-loop */
