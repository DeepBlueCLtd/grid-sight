import { describe, it, expect, beforeEach } from 'vitest';
import { buildCrossDocumentIndex } from '../annotation-index';
import { urlStem } from '../../utils/slider-persistence';

beforeEach(() => {
  localStorage.clear();
});

function seed(stem: string, title: string, entries: Record<string, { t: string; m: number }>) {
  localStorage.setItem(`gs:${stem}:annotations`, JSON.stringify({ version: 1, title, entries }));
}

describe('buildCrossDocumentIndex', () => {
  it('selects only ^gs:.*:annotations$ keys', () => {
    seed('https://x.test/a', 'Doc A', { 'sales/acme/q3': { t: 'note', m: 5 } });
    localStorage.setItem('gs:https://x.test/a:sliders', JSON.stringify({ version: 1, entries: {} }));
    localStorage.setItem('unrelated', 'x');
    const model = buildCrossDocumentIndex();
    expect(model).toHaveLength(1);
    expect(model[0].documentLabel).toBe('Doc A');
    expect(model[0].entries).toHaveLength(1);
  });

  it('groups by document and orders groups + entries by modifiedAt desc', () => {
    seed('https://x.test/old', 'Old', { 'a/b/c': { t: 'older', m: 100 } });
    seed('https://x.test/new', 'New', {
      'a/b/c': { t: 'newest', m: 300 },
      'a/b/d': { t: 'middle', m: 200 },
    });
    const model = buildCrossDocumentIndex();
    expect(model.map((g) => g.documentLabel)).toEqual(['New', 'Old']);
    expect(model[0].entries.map((e) => e.previewText)).toEqual(['newest', 'middle']);
  });

  it('flags isCurrentDocument for the current stem', () => {
    seed(urlStem(), 'Here', { 'a/b/c': { t: 'x', m: 1 } });
    seed('https://other.test/p', 'There', { 'a/b/c': { t: 'y', m: 2 } });
    const model = buildCrossDocumentIndex();
    const here = model.find((g) => g.documentLabel === 'Here')!;
    const there = model.find((g) => g.documentLabel === 'There')!;
    expect(here.entries[0].isCurrentDocument).toBe(true);
    expect(there.entries[0].isCurrentDocument).toBe(false);
  });

  it('yields an empty model when there are no annotations', () => {
    expect(buildCrossDocumentIndex()).toEqual([]);
  });

  it('skips malformed / legacy envelopes', () => {
    localStorage.setItem('gs:https://x.test/bad:annotations', '{not json');
    localStorage.setItem(
      'gs:https://x.test/legacy:annotations',
      JSON.stringify({ version: 2, entries: { 'a/b/c': { t: 'x', m: 1 } } })
    );
    expect(buildCrossDocumentIndex()).toEqual([]);
  });
});
