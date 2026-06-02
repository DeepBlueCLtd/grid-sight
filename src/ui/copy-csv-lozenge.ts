/**
 * Copy-as-CSV corner lozenge (spec 009). Registers a table-level affordance
 * (`headerType === 'table'`) that opens the copy popup. A table qualifies unless
 * it carries `data-gs-no-export` (`data-gs-ignore` is already excluded upstream
 * by the descriptor injection pass). Side-effect imported from `src/index.ts`.
 */

import { registerEnrichment } from '../core/enrichment-registry';
import { openCopyPopup } from './copy-csv-popup';
// Ensure the toast module loads (registers its teardown hook) alongside the UI.
import './copy-toast';

function buildCopyLozenge(table: HTMLTableElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  // Reuse the shared lozenge class so it matches siblings and the existing
  // `removePlusIcons` teardown (which clears `.gs-lozenge` + empty clusters).
  btn.className = 'gs-lozenge';
  btn.textContent = '⎘';
  btn.title = 'Copy table as CSV / TSV / Markdown';
  btn.setAttribute('aria-label', 'Copy table');
  btn.setAttribute('data-gs-lozenge-id', 'copy-as-csv');
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openCopyPopup({ table, anchor: btn });
  });
  return btn;
}

registerEnrichment({
  id: 'copy-as-csv',
  appliesTo: (ctx) =>
    ctx.headerType === 'table' && !ctx.table.hasAttribute('data-gs-no-export'),
  mount: (ctx) => buildCopyLozenge(ctx.table),
});
