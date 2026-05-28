import { describe, it, expect, beforeEach } from 'vitest';
import { registerAnnotationsMenuEntry, openAnnotationsPopup } from '../annotation-popup';
import { __resetAnnotations } from '../../enrichments/annotations';
import { urlStem } from '../../utils/slider-persistence';

function seed(stem: string, title: string, entries: Record<string, { t: string; m: number }>) {
  localStorage.setItem(`gs:${stem}:annotations`, JSON.stringify({ version: 1, title, entries }));
}

function popup(): HTMLElement | null {
  return document.querySelector('.gs-annotation-popup');
}

beforeEach(() => {
  localStorage.clear();
  __resetAnnotations();
  document.body.innerHTML = '';
});

describe('registerAnnotationsMenuEntry', () => {
  it('is absent when the origin has no annotations', () => {
    registerAnnotationsMenuEntry();
    expect(document.querySelector('.gs-annotations-menu-entry')).toBeNull();
  });

  it('appears when the origin has ≥ 1 annotation', () => {
    seed(urlStem(), 'Here', { 'a/b/c': { t: 'note', m: 1 } });
    registerAnnotationsMenuEntry();
    expect(document.querySelector('.gs-annotations-menu-entry')).not.toBeNull();
  });
});

describe('openAnnotationsPopup', () => {
  it('renders grouped entries with date metadata', () => {
    seed(urlStem(), 'Here', { 'sales/acme/q3': { t: 'check', m: 1769414400000 } });
    seed('https://other.test/p', 'There', { 'sales/acme/q3': { t: 'verify', m: 1769410800000 } });
    openAnnotationsPopup();
    const entries = popup()!.querySelectorAll('.gs-annotation-popup__entry');
    expect(entries.length).toBe(2);
    const labels = Array.from(popup()!.querySelectorAll('.gs-annotation-popup__group-label')).map(
      (e) => e.textContent
    );
    expect(labels).toEqual(expect.arrayContaining(['Here', 'There']));
  });

  it('renders an empty-state message when there are no annotations', () => {
    openAnnotationsPopup();
    expect(popup()!.querySelector('.gs-annotation-popup__empty')).not.toBeNull();
  });

  it('Escape closes the popup', () => {
    seed(urlStem(), 'Here', { 'a/b/c': { t: 'x', m: 1 } });
    openAnnotationsPopup();
    popup()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popup()).toBeNull();
  });

  it('arrow keys move focus between entries', () => {
    seed(urlStem(), 'Here', { 'a/b/c': { t: 'one', m: 2 }, 'a/b/d': { t: 'two', m: 1 } });
    openAnnotationsPopup();
    const entries = Array.from(
      popup()!.querySelectorAll<HTMLButtonElement>('.gs-annotation-popup__entry')
    );
    expect(document.activeElement).toBe(entries[0]);
    popup()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(entries[1]);
  });
});
