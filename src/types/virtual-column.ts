/**
 * Virtual column type definitions (spec 012-virtual-columns).
 * See specs/012-virtual-columns/data-model.md.
 */

export type VirtualColumnKind = 'cumulative' | 'compare' | 'sparkline';

export interface CumulativeDirective {
  id: string;
  kind: 'cumulative';
  tableEl: HTMLTableElement;
  sourceColKey: string;
  mode: 'sum' | 'percent';
  activationIndex: number;
}

export interface CompareDirective {
  id: string;
  kind: 'compare';
  tableEl: HTMLTableElement;
  colKeyA: string;
  colKeyB: string;
  mode: 'abs' | 'rel' | 'percent';
}

export interface SparklineDirective {
  id: string;
  kind: 'sparkline';
  tableEl: HTMLTableElement;
  scale: 'per-row' | 'shared';
  style: 'bar';
}

export type VirtualColumnDirective =
  | CumulativeDirective
  | CompareDirective
  | SparklineDirective;

export interface AppendedColumnRecord {
  directiveId: string;
  headerCells: HTMLTableCellElement[];
  bodyCells: Map<HTMLTableRowElement, HTMLTableCellElement>;
  footerCells: HTMLTableCellElement[];
  position: number;
}

export interface VirtualColumnExport {
  headerText: string;
  getCellText(rowEl: HTMLTableRowElement): string;
}

export type RowState = 'visible' | 'dimmed' | 'hidden';

export interface VisibleRowEntry {
  rowEl: HTMLTableRowElement;
  state: RowState;
}

export interface Renderer<D extends VirtualColumnDirective> {
  readonly kind: D['kind'];
  headerText(directive: D): string;
  canActivate?(
    directive: D,
    table: HTMLTableElement,
    numericColumns: ReadonlySet<string>,
  ): boolean;
  renderCell(
    directive: D,
    td: HTMLTableCellElement,
    rowEl: HTMLTableRowElement,
    sequence: VisibleRowEntry[],
    rowIndex: number,
  ): void;
  onPipelineChange(
    directive: D,
    record: AppendedColumnRecord,
    sequence: VisibleRowEntry[],
  ): void;
  onDetach?(directive: D, record: AppendedColumnRecord): void;
  exporter(directive: D): VirtualColumnExport;
}
