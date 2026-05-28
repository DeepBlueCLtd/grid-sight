import { describe, it, expect, beforeEach } from 'vitest';
import { openAnnotationPopover } from '../annotation-popover';
import { __resetAnnotations, getAnnotation, saveAnnotation } from '../../enrichments/annotations';
import { __resetIdentityWarnings } from '../../enrichments/annotation-identity';

function makeCell(): HTMLTableCellElement {
  document.body.innerHTML = `
    <table data-gs-key="t">
      <thead><tr><th>Region</th><th>Q3</th></tr></thead>
      <tbody><tr data-gs-row-key="acme"><th scope="row">Acme</th><td>1200</td></tr></tbody>
    </table>`;
  return document.querySelector('tbody td') as HTMLTableCellElement;
}

function popover(): HTMLElement {
  return document.querySelector('.gs-annotation-popover') as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  __resetAnnotations();
  __resetIdentityWarnings();
  document.body.innerHTML = '';
});

describe('open + focus contract', () => {
  it('focus lands in the textarea on open', () => {
    const cell = makeCell();
    openAnnotationPopover(cell);
    const ta = popover().querySelector('textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(ta);
  });

  it('Delete is disabled when there is no note, enabled when one exists', () => {
    const cell = makeCell();
    openAnnotationPopover(cell);
    let del = popover().querySelector('button:last-of-type') as HTMLButtonElement;
    expect(del.disabled).toBe(true);

    // Save a note, reopen → delete enabled.
    saveAnnotation(cell, 'note');
    openAnnotationPopover(cell);
    del = popover().querySelector('button:last-of-type') as HTMLButtonElement;
    expect(del.disabled).toBe(false);
  });
});

describe('280-char clamp', () => {
  it('clamps textarea input to 280 chars', () => {
    const cell = makeCell();
    openAnnotationPopover(cell);
    const ta = popover().querySelector('textarea') as HTMLTextAreaElement;
    ta.value = 'x'.repeat(400);
    ta.dispatchEvent(new Event('input'));
    expect(ta.value).toHaveLength(280);
  });
});

describe('Save / Delete actions', () => {
  it('Save persists the note and closes the popover', () => {
    const cell = makeCell();
    openAnnotationPopover(cell);
    const ta = popover().querySelector('textarea') as HTMLTextAreaElement;
    ta.value = 'check this';
    (popover().querySelector('button') as HTMLButtonElement).click(); // first button = Save
    expect(getAnnotation(cell)).toBe('check this');
    expect(popover()).toBeNull();
  });

  it('Escape closes without saving', () => {
    const cell = makeCell();
    openAnnotationPopover(cell);
    const pop = popover();
    const ta = pop.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = 'unsaved';
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popover()).toBeNull();
    expect(getAnnotation(cell)).toBeUndefined();
  });
});
