import { describe, it, expect } from 'vitest';
import { normalizeForCompare } from '../../e2e/helpers/teardown';

describe('normalizeForCompare (6A/7A)', () => {
  it('collapses benign whitespace differences between and inside tags', () => {
    const a = `<table>\n  <tbody>\n    <tr>   <td>1</td>  </tr>\n  </tbody>\n</table>`;
    const b = `<table><tbody><tr><td>1</td></tr></tbody></table>`;
    expect(normalizeForCompare(a)).toBe(normalizeForCompare(b));
  });

  it('preserves every gs-* class', () => {
    const out = normalizeForCompare(`<button class="gs-lozenge gs-lozenge--active">x</button>`);
    expect(out).toContain('gs-lozenge');
    expect(out).toContain('gs-lozenge--active');
  });

  it('preserves every gs-* attribute', () => {
    const out = normalizeForCompare(`<span data-gs-lozenge-id="outlier" aria-disabled="true"></span>`);
    expect(out).toContain('data-gs-lozenge-id="outlier"');
    expect(out).toContain('aria-disabled="true"');
  });

  it('preserves gs-* nodes (does not drop appended enrichment cells)', () => {
    const withArtifact = `<table><tr><td>1</td><td data-gs-enrichment="cumulative">Σ</td></tr></table>`;
    const without = `<table><tr><td>1</td></tr></table>`;
    expect(normalizeForCompare(withArtifact)).toContain('data-gs-enrichment="cumulative"');
    expect(normalizeForCompare(withArtifact)).not.toBe(normalizeForCompare(without));
  });
});
