/**
 * `find-in-table` enrichment (spec 014). Search a table and step through the
 * matches, scoped to the VISIBLE rows.
 *
 * Highlighting is **cell-level** — a class on each matching cell
 * (`gs-find-match`), with a stronger class on the active one
 * (`gs-find-current`). No `<mark>` / text-node surgery, so `clear()` is a
 * trivially exact, byte-identical teardown (remove the two classes, drop any
 * now-empty `class=""`). Scaffolding (`data-gs-injected`) is never matched
 * because matches are read through the addressing layer (`gridCells`).
 *
 * The transient query state lives in the controller returned by
 * `createFindController`; the box UI (search input + counter + prev/next) lives
 * in `find-in-table-box.ts`. `removeFindUi` is the registry teardown hook.
 */

import { gridCells, cellValue } from '../core/table-grid';
import { visibleBodyRows } from '../utils/visible-rows';

const MATCH_CLASS = 'gs-find-match';
const CURRENT_CLASS = 'gs-find-current';
const LOZENGE_SELECTOR = '[data-gs-lozenge-id="find-in-table"]';

export interface FindController {
  /** Rebuild matches over the current visible rows for `term`; reset to first. */
  search(term: string): void;
  next(): void;
  prev(): void;
  /** Remove all highlight classes + drop state (byte-identical). */
  clear(): void;
  matchCount(): number;
  /** 1-based ordinal of the active match; 0 when none. */
  currentOrdinal(): number;
}

/** A live find session bound to a table (controller + a box-close callback),
 *  so `removeFindUi` can tear an open box down on toggle-off. */
interface FindSession {
  controller: FindController;
  closeBox: () => void;
}
const sessions = new WeakMap<HTMLTableElement, FindSession>();

export function registerFindSession(table: HTMLTableElement, session: FindSession): void {
  sessions.set(table, session);
}
export function clearFindSession(table: HTMLTableElement): void {
  sessions.delete(table);
}

function dropClass(el: Element, cls: string): void {
  el.classList.remove(cls);
  if (el.getAttribute('class') === '') el.removeAttribute('class');
}

/** Remove every match/current class from the table (byte-identical). */
function clearAllHighlights(table: HTMLTableElement): void {
  table.querySelectorAll('.' + CURRENT_CLASS).forEach((c) => dropClass(c, CURRENT_CLASS));
  table.querySelectorAll('.' + MATCH_CLASS).forEach((c) => dropClass(c, MATCH_CLASS));
}

function scrollIntoView(cell: HTMLTableCellElement): void {
  if (typeof cell.scrollIntoView !== 'function') return;
  try {
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch {
    /* jsdom / unsupported — ignore */
  }
}

/** Create a controller bound to a table. */
export function createFindController(table: HTMLTableElement): FindController {
  let matches: HTMLTableCellElement[] = [];
  let currentIndex = -1;

  function setCurrent(i: number): void {
    if (matches[currentIndex]) matches[currentIndex].classList.remove(CURRENT_CLASS);
    currentIndex = i;
    const cell = matches[currentIndex];
    if (cell) {
      cell.classList.add(CURRENT_CLASS);
      scrollIntoView(cell);
    }
  }

  return {
    search(term: string): void {
      clearAllHighlights(table);
      matches = [];
      currentIndex = -1;
      const needle = term.trim().toLowerCase();
      if (!needle) return;
      for (const row of visibleBodyRows(table)) {
        for (const cell of gridCells(row)) {
          if (cellValue(cell).toLowerCase().includes(needle)) {
            cell.classList.add(MATCH_CLASS);
            matches.push(cell);
          }
        }
      }
      if (matches.length > 0) setCurrent(0);
    },
    next(): void {
      if (matches.length === 0) return;
      setCurrent((currentIndex + 1) % matches.length);
    },
    prev(): void {
      if (matches.length === 0) return;
      setCurrent((currentIndex - 1 + matches.length) % matches.length);
    },
    clear(): void {
      clearAllHighlights(table);
      matches = [];
      currentIndex = -1;
    },
    matchCount(): number {
      return matches.length;
    },
    currentOrdinal(): number {
      return currentIndex < 0 ? 0 : currentIndex + 1;
    },
  };
}

/** Remove the find lozenge + any open box + all highlights. Teardown hook
 *  (registry `tearDown` for `find-in-table`). Byte-identical. */
export function removeFindUi(table: HTMLTableElement): void {
  const session = sessions.get(table);
  if (session) {
    try {
      session.closeBox();
    } catch {
      /* ignore */
    }
  }
  sessions.delete(table);
  // Defensive: clear any residual highlights the box close did not.
  clearAllHighlights(table);
  // Remove the corner lozenge (the cluster rebuild also handles this, but keep
  // the teardown self-contained for direct callers).
  table.querySelectorAll(LOZENGE_SELECTOR).forEach((el) => el.remove());
}
