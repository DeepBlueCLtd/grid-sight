import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyAnnotations,
  saveAnnotation,
  deleteAnnotation,
  getAnnotation,
  tearDownAnnotations,
  __resetAnnotations,
} from '../annotations';
import { __resetIdentityWarnings } from '../annotation-identity';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function makeTable(): HTMLTableElement {
  document.body.innerHTML = `
    <table data-gs-key="sales">
      <thead><tr><th>Region</th><th>Q3</th></tr></thead>
      <tbody>
        <tr data-gs-row-key="acme"><th scope="row">Acme</th><td>1200</td></tr>
        <tr data-gs-row-key="globex"><th scope="row">Globex</th><td>980</td></tr>
      </tbody>
    </table>`;
  return document.querySelector('table') as HTMLTableElement;
}

beforeEach(() => {
  localStorage.clear();
  __resetAnnotations();
  __resetIdentityWarnings();
  document.body.innerHTML = '';
});

describe('saveAnnotation / getAnnotation / deleteAnnotation', () => {
  it('upserts the store, sets modifiedAt, and getAnnotation reflects it', () => {
    const table = makeTable();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    const before = Date.now();
    expect(saveAnnotation(cell, 'check this')).toEqual({ ok: true });
    expect(getAnnotation(cell)).toBe('check this');

    const raw = localStorage.getItem(
      Object.keys(localStorage).find((k) => k.endsWith(':annotations'))!
    )!;
    const env = JSON.parse(raw);
    expect(env.version).toBe(1);
    const entry = env.entries['sales/acme/q3'];
    expect(entry.t).toBe('check this');
    expect(entry.m).toBeGreaterThanOrEqual(before);
  });

  it('empty/whitespace save deletes', () => {
    const table = makeTable();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    saveAnnotation(cell, 'note');
    expect(getAnnotation(cell)).toBe('note');
    saveAnnotation(cell, '   ');
    expect(getAnnotation(cell)).toBeUndefined();
  });

  it('clamps to 280 chars', () => {
    const table = makeTable();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    saveAnnotation(cell, 'x'.repeat(400));
    expect(getAnnotation(cell)).toHaveLength(280);
  });

  it('deleteAnnotation removes the note and the marker', () => {
    const table = makeTable();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    saveAnnotation(cell, 'note');
    expect(cell.querySelector('.gs-annotation-marker')).not.toBeNull();
    deleteAnnotation(cell);
    expect(getAnnotation(cell)).toBeUndefined();
    expect(cell.querySelector('.gs-annotation-marker')).toBeNull();
    expect(cell.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('tearDownAnnotations — byte-identical restore', () => {
  it('restores cells byte-identically after apply (no notes)', async () => {
    const table = makeTable();
    const tbody = table.tBodies[0];
    const snapshot = tbody.innerHTML;
    applyAnnotations(table);
    await nextFrame();
    expect(tbody.innerHTML).not.toBe(snapshot); // pins injected
    tearDownAnnotations(table);
    expect(tbody.innerHTML).toBe(snapshot);
  });

  it('restores cells byte-identically after a saved-then-deleted note', async () => {
    const table = makeTable();
    const tbody = table.tBodies[0];
    const snapshot = tbody.innerHTML;
    applyAnnotations(table);
    await nextFrame();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    saveAnnotation(cell, 'note');
    deleteAnnotation(cell);
    tearDownAnnotations(table);
    expect(tbody.innerHTML).toBe(snapshot);
  });

  // quickstart.md §"toggle-off" clause: tearDown restores the DOM but MUST leave
  // the localStorage envelope intact so toggle-on / reload re-hydrates.
  it('leaves the localStorage envelope intact after teardown', () => {
    const table = makeTable();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    saveAnnotation(cell, 'durable note');
    const key = Object.keys(localStorage).find((k) => k.endsWith(':annotations'))!;
    expect(localStorage.getItem(key)).not.toBeNull();

    tearDownAnnotations(table);
    expect(cell.querySelector('.gs-annotation-marker')).toBeNull(); // DOM restored
    expect(localStorage.getItem(key)).not.toBeNull(); // envelope retained
    expect(JSON.parse(localStorage.getItem(key)!).entries['sales/acme/q3'].t).toBe('durable note');
  });
});

describe('session-only fallback when storage is unavailable (FR-017, quickstart §4)', () => {
  let setItem: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    setItem.mockRestore();
    warn.mockRestore();
  });

  it('allows the save in-memory (no quota refusal) and warns exactly once', () => {
    const table = makeTable();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;

    const result = saveAnnotation(cell, 'session note');
    expect(result).toEqual({ ok: true }); // NOT refused as quota
    expect(getAnnotation(cell)).toBe('session note');
    expect(cell.querySelector('.gs-annotation-marker')).not.toBeNull();

    // Saving again does not multiply the warning (one per page).
    saveAnnotation(cell, 'session note 2');
    const sessionWarns = warn.mock.calls.filter((c) =>
      String(c[0]).includes('localStorage is unavailable')
    );
    expect(sessionWarns).toHaveLength(1);
  });
});
