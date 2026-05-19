import type { TableViewDirective } from './visible-rows';
import { splitTopLevelSegments, parseSegment } from './view-state-parse';

export function decodeViewState(raw: string): TableViewDirective[] {
  if (!raw) return [];
  const out: TableViewDirective[] = [];
  for (const seg of splitTopLevelSegments(raw)) {
    const parsed = parseSegment(seg);
    if (parsed) out.push(parsed);
  }
  return out;
}
