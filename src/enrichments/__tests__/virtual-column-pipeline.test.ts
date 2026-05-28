import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerRenderer,
  activateDirective,
  detachAll,
  __flushVirtualColumnFrame,
} from '../virtual-column';
import { setSort, clearFilters } from '../../utils/visible-rows';
import type {
  CompareDirective,
  CumulativeDirective,
  Renderer,
  SparklineDirective,
} from '../../types/virtual-column';

interface CallRecord {
  kind: string;
  directiveId: string;
}

const calls: CallRecord[] = [];

function recordingRenderer<D extends { id: string; kind: string }>(
  kind: D['kind'],
  base: Renderer<any>,
): Renderer<any> {
  return {
    ...base,
    kind,
    onPipelineChange(directive: any, record: any, sequence: any) {
      calls.push({ kind, directiveId: directive.id });
      base.onPipelineChange(directive, record, sequence);
    },
  } as Renderer<any>;
}

function emptyRenderer<K extends 'cumulative' | 'compare' | 'sparkline'>(
  kind: K,
): Renderer<any> {
  return {
    kind,
    headerText: () => kind,
    canActivate: () => true,
    renderCell: () => {},
    onPipelineChange: () => {},
    exporter: () => ({ headerText: kind, getCellText: () => '' }),
  } as Renderer<any>;
}

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'pipe-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Region', 'Q1', 'Q4', 'Weight'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (let r = 0; r < 3; r++) {
    const tr = document.createElement('tr');
    [`r${r}`, String(r + 1), String(r * 10), String(r * 5)].forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  document.body.appendChild(t);
  return t;
}

let rafSpy: { mockRestore(): void } | null = null;
let rafCalls = 0;

beforeEach(() => {
  calls.length = 0;
  rafCalls = 0;
  detachAll();
  document.body.innerHTML = '';
  // Register recording stand-ins for all three kinds.
  registerRenderer(recordingRenderer('cumulative', emptyRenderer('cumulative')));
  registerRenderer(recordingRenderer('compare', emptyRenderer('compare')));
  registerRenderer(recordingRenderer('sparkline', emptyRenderer('sparkline')));
  // Deferred rAF mock: count requests but never auto-invoke the callback.
  // Tests explicitly call __flushVirtualColumnFrame() to drain. This lets us
  // observe coalescing (multiple requests in a tick → one queued frame).
  rafSpy = vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((_cb: FrameRequestCallback) => {
      rafCalls += 1;
      return rafCalls;
    });
});

afterEach(() => {
  rafSpy?.mockRestore();
});

describe('virtual-column pipeline fan-out (US8)', () => {
  it('fires renderers in canonical order: cumulative → compare → sparkline', () => {
    const table = makeTable();
    // Activate in reverse canonical order to exercise sorting.
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    } as SparklineDirective);
    activateDirective({
      id: 'cmp-q1-q4',
      kind: 'compare',
      tableEl: table,
      colKeyA: 'q1',
      colKeyB: 'q4',
      mode: 'abs',
    } as CompareDirective);
    activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    } as CumulativeDirective);

    calls.length = 0;
    rafCalls = 0;
    setSort(table, { columnIndex: 1, columnKey: 'q1', direction: 'asc' });
    __flushVirtualColumnFrame();
    expect(calls.map((c) => c.kind)).toEqual(['cumulative', 'compare', 'sparkline']);
  });

  it('coalesces multiple events in the same tick into one rAF callback', () => {
    const table = makeTable();
    activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    } as CumulativeDirective);

    calls.length = 0;
    rafCalls = 0;
    // Two pipeline events in the same tick should coalesce into one rAF.
    setSort(table, { columnIndex: 1, columnKey: 'q1', direction: 'asc' });
    setSort(table, { columnIndex: 1, columnKey: 'q1', direction: 'desc' });
    expect(rafCalls).toBe(1);
    __flushVirtualColumnFrame();
    // Renderer was called once per directive after the single rAF, not per
    // pipeline event.
    const cumulativeCalls = calls.filter((c) => c.kind === 'cumulative');
    expect(cumulativeCalls.length).toBe(1);
    clearFilters(table);
  });
});
