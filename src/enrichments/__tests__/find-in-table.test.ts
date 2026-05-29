import { describe, it, expect, beforeEach } from 'vitest';
import { createFindController } from '../find-in-table';

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.innerHTML =
    '<thead><tr><th>Name</th><th>Role</th></tr></thead>' +
    '<tbody>' +
    '<tr><td>Alice</td><td>admin</td></tr>' +
    '<tr><td>Bob</td><td>ADMIN</td></tr>' +
    '<tr><td>Carol</td><td>user</td></tr>' +
    '<tr><td>Dave</td><td>admin</td></tr>' +
    '</tbody>';
  document.body.appendChild(t);
  return t;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('find-in-table controller', () => {
  it('builds an ordered, case-insensitive match list over visible cells', () => {
    const t = makeTable();
    const c = createFindController(t);
    c.search('admin');
    expect(c.matchCount()).toBe(3); // admin, ADMIN, admin (case-insensitive)
    expect(c.currentOrdinal()).toBe(1);
    const matched = Array.from(t.querySelectorAll('.gs-find-match')).map((el) => el.textContent);
    expect(matched).toEqual(['admin', 'ADMIN', 'admin']);
    expect(t.querySelectorAll('.gs-find-current').length).toBe(1);
  });

  it('next() and prev() wrap around', () => {
    const t = makeTable();
    const c = createFindController(t);
    c.search('admin');
    c.next();
    expect(c.currentOrdinal()).toBe(2);
    c.next();
    expect(c.currentOrdinal()).toBe(3);
    c.next();
    expect(c.currentOrdinal()).toBe(1); // wrap forward
    c.prev();
    expect(c.currentOrdinal()).toBe(3); // wrap backward
  });

  it('excludes scaffold cells from matches', () => {
    const t = makeTable();
    const row = t.tBodies[0].rows[0];
    const scaffold = document.createElement('td');
    scaffold.setAttribute('data-gs-injected', '');
    scaffold.textContent = 'admin';
    row.appendChild(scaffold);

    const c = createFindController(t);
    c.search('admin');
    expect(c.matchCount()).toBe(3); // the injected 'admin' cell is not matched
    expect(scaffold.classList.contains('gs-find-match')).toBe(false);
  });

  it('clear() removes every highlight class, byte-identical', () => {
    const t = makeTable();
    const before = t.outerHTML;
    const c = createFindController(t);
    c.search('admin');
    expect(t.querySelectorAll('.gs-find-match').length).toBeGreaterThan(0);
    c.clear();
    expect(t.querySelectorAll('.gs-find-match, .gs-find-current').length).toBe(0);
    expect(t.outerHTML).toBe(before);
  });

  it('reports zero and clears highlights for a no-match or empty term', () => {
    const t = makeTable();
    const c = createFindController(t);
    c.search('admin');
    c.search('zzz');
    expect(c.matchCount()).toBe(0);
    expect(c.currentOrdinal()).toBe(0);
    expect(t.querySelectorAll('.gs-find-match').length).toBe(0);
    c.search('   '); // whitespace-only → cleared, no throw
    expect(c.matchCount()).toBe(0);
  });
});
