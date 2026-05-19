/**
 * URL fragment codec for virtual columns (spec 012-virtual-columns §R-5).
 * Namespace: gs.vc
 *
 * Grammar:
 *   gs.vc = <table-block>(";" <table-block>)*
 *   <table-block> = <tableKey> ":" <directive-token>("," <directive-token>)*
 *   <cumulative-token> = "c." <colKey> "." ("s"|"p")
 *   <compare-token>    = "d." <colKeyA> "." <colKeyB> "." ("a"|"r"|"p")
 *   <sparkline-token>  = "t." ("r"|"s")
 */

const URL_FRAGMENT_PARAM = 'gs.vc';

export type PersistedCumulative = { kind: 'cumulative'; colKey: string; mode: 'sum' | 'percent' };
export type PersistedCompare = { kind: 'compare'; colKeyA: string; colKeyB: string; mode: 'abs' | 'rel' | 'percent' };
export type PersistedSparkline = { kind: 'sparkline'; scale: 'per-row' | 'shared' };
export type PersistedToken = PersistedCumulative | PersistedCompare | PersistedSparkline;

export interface PersistedTableBlock {
  tableKey: string;
  tokens: PersistedToken[];
}

export interface PersistedVirtualColumnState {
  blocks: PersistedTableBlock[];
}

const CUM_MODE: Record<'sum' | 'percent', string> = { sum: 's', percent: 'p' };
const CUM_MODE_INV: Record<string, 'sum' | 'percent'> = { s: 'sum', p: 'percent' };
const CMP_MODE: Record<'abs' | 'rel' | 'percent', string> = { abs: 'a', rel: 'r', percent: 'p' };
const CMP_MODE_INV: Record<string, 'abs' | 'rel' | 'percent'> = { a: 'abs', r: 'rel', p: 'percent' };
const SPK_SCALE: Record<'per-row' | 'shared', string> = { 'per-row': 'r', shared: 's' };
const SPK_SCALE_INV: Record<string, 'per-row' | 'shared'> = { r: 'per-row', s: 'shared' };

/** lowercase, non-alphanumeric → "-", deduplicated. */
export function slugifyColumnKey(headerText: string): string {
  return (headerText || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

const SAFE_KEY = /^[a-z0-9-]+$/;
const SAFE_TABLE_KEY = /^[a-zA-Z0-9_.#-]+$/;

function emitToken(t: PersistedToken): string | null {
  switch (t.kind) {
    case 'cumulative':
      if (!SAFE_KEY.test(t.colKey)) return null;
      return `c.${t.colKey}.${CUM_MODE[t.mode]}`;
    case 'compare':
      if (!SAFE_KEY.test(t.colKeyA) || !SAFE_KEY.test(t.colKeyB)) return null;
      return `d.${t.colKeyA}.${t.colKeyB}.${CMP_MODE[t.mode]}`;
    case 'sparkline':
      return `t.${SPK_SCALE[t.scale]}`;
  }
}

function parseToken(text: string): PersistedToken | null {
  const parts = text.split('.');
  if (parts.length < 2) return null;
  const prefix = parts[0];
  if (prefix === 'c') {
    if (parts.length !== 3) return null;
    const [, colKey, mode] = parts;
    if (!SAFE_KEY.test(colKey) || !(mode in CUM_MODE_INV)) return null;
    return { kind: 'cumulative', colKey, mode: CUM_MODE_INV[mode] };
  }
  if (prefix === 'd') {
    if (parts.length !== 4) return null;
    const [, colKeyA, colKeyB, mode] = parts;
    if (!SAFE_KEY.test(colKeyA) || !SAFE_KEY.test(colKeyB) || !(mode in CMP_MODE_INV)) return null;
    return { kind: 'compare', colKeyA, colKeyB, mode: CMP_MODE_INV[mode] };
  }
  if (prefix === 't') {
    if (parts.length !== 2) return null;
    const [, scale] = parts;
    if (!(scale in SPK_SCALE_INV)) return null;
    return { kind: 'sparkline', scale: SPK_SCALE_INV[scale] };
  }
  // Unknown prefix — ignored silently.
  return null;
}

/** Encode persisted state into a fragment value (no `#`, no `gs.vc=`). */
export function encodeFragment(state: PersistedVirtualColumnState): string {
  const blocks: string[] = [];
  for (const block of state.blocks) {
    if (!SAFE_TABLE_KEY.test(block.tableKey)) continue;
    const tokens = block.tokens.map(emitToken).filter((s): s is string => s !== null);
    if (tokens.length === 0) continue;
    blocks.push(`${block.tableKey}:${tokens.join(',')}`);
  }
  return blocks.join(';');
}

/** Decode a fragment value into persisted state. Invalid tokens are dropped. */
export function decodeFragment(text: string): PersistedVirtualColumnState {
  const state: PersistedVirtualColumnState = { blocks: [] };
  if (!text) return state;
  for (const blockText of text.split(';')) {
    if (!blockText) continue;
    const colonIdx = blockText.indexOf(':');
    if (colonIdx <= 0) continue;
    const tableKey = blockText.slice(0, colonIdx);
    if (!SAFE_TABLE_KEY.test(tableKey)) continue;
    const tokensText = blockText.slice(colonIdx + 1);
    const seenCumulative = new Map<string, PersistedCumulative>();
    let compareToken: PersistedCompare | null = null;
    let sparklineToken: PersistedSparkline | null = null;
    const orderedCumulative: PersistedCumulative[] = [];

    for (const tokenText of tokensText.split(',')) {
      if (!tokenText) continue;
      const tok = parseToken(tokenText);
      if (!tok) continue;
      if (tok.kind === 'cumulative') {
        if (seenCumulative.has(tok.colKey)) {
          // Replace (keep last per data-model.md).
          const idx = orderedCumulative.findIndex((c) => c.colKey === tok.colKey);
          if (idx >= 0) orderedCumulative[idx] = tok;
        } else {
          orderedCumulative.push(tok);
        }
        seenCumulative.set(tok.colKey, tok);
      } else if (tok.kind === 'compare') {
        if (compareToken === null) compareToken = tok; // keep first
      } else if (tok.kind === 'sparkline') {
        if (sparklineToken === null) sparklineToken = tok; // keep first
      }
    }

    const tokens: PersistedToken[] = [];
    for (const c of orderedCumulative) tokens.push(c);
    if (compareToken) tokens.push(compareToken);
    if (sparklineToken) tokens.push(sparklineToken);
    if (tokens.length > 0) state.blocks.push({ tableKey, tokens });
  }
  return state;
}

/** Read state from a hash string (with or without leading `#`). */
export function readFromHash(
  hash: string = (typeof location !== 'undefined' ? location.hash : ''),
): PersistedVirtualColumnState {
  if (!hash) return { blocks: [] };
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of stripped.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) === URL_FRAGMENT_PARAM) {
      return decodeFragment(decodeURIComponent(part.slice(eq + 1)));
    }
  }
  return { blocks: [] };
}

/** Produce a new hash string with the gs.vc parameter updated, preserving others. */
export function writeHash(
  state: PersistedVirtualColumnState,
  currentHash: string = (typeof location !== 'undefined' ? location.hash : ''),
): string {
  const stripped = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash;
  const params = stripped ? stripped.split('&') : [];
  const kept = params.filter((p) => !p.startsWith(`${URL_FRAGMENT_PARAM}=`));
  const encoded = encodeFragment(state);
  if (encoded) kept.push(`${URL_FRAGMENT_PARAM}=${encodeURIComponent(encoded)}`);
  return kept.length === 0 ? '' : '#' + kept.join('&');
}

export { URL_FRAGMENT_PARAM };
