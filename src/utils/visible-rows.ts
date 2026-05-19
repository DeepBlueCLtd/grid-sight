/**
 * Visible Row Sequence interface (spec 012-virtual-columns §R-3).
 * Passthrough stub; replaced in-place when 002-003-row-visibility lands.
 */

import type { VisibleRowEntry } from '../types/virtual-column';

export type { RowState, VisibleRowEntry } from '../types/virtual-column';

export interface VisibleRowSubscription {
  current(): VisibleRowEntry[];
  subscribe(cb: (entries: VisibleRowEntry[]) => void): () => void;
}

type Impl = (table: HTMLTableElement) => VisibleRowSubscription;

const subscriptions = new WeakMap<HTMLTableElement, VisibleRowSubscription>();

function defaultImpl(table: HTMLTableElement): VisibleRowSubscription {
  let cached = subscriptions.get(table);
  if (cached) return cached;

  const callbacks: Array<(entries: VisibleRowEntry[]) => void> = [];

  cached = {
    current(): VisibleRowEntry[] {
      const tbody = table.tBodies[0];
      if (!tbody) return [];
      return Array.from(tbody.rows).map((rowEl) => ({
        rowEl,
        state: 'visible' as const,
      }));
    },
    subscribe(cb): () => void {
      callbacks.push(cb);
      return () => {
        const idx = callbacks.indexOf(cb);
        if (idx >= 0) callbacks.splice(idx, 1);
      };
    },
  };

  subscriptions.set(table, cached);
  return cached;
}

let currentImpl: Impl = defaultImpl;

export function getVisibleRows(table: HTMLTableElement): VisibleRowSubscription {
  return currentImpl(table);
}

/** Test-only: override the implementation. Tree-shaken in production builds. */
export function __setVisibleRowsImpl(impl: Impl | null): void {
  currentImpl = impl ?? defaultImpl;
  // Clear cached subscriptions so the new impl takes effect for any table.
  // WeakMap has no clear(), but assignment of a new impl bypasses old cache.
}

if (typeof globalThis !== 'undefined' && (import.meta as { env?: { MODE?: string } }).env?.MODE !== 'production') {
  (globalThis as Record<string, unknown>).__gridSightSetVisibleRowsImpl = __setVisibleRowsImpl;
}
