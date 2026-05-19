/**
 * Inline-SVG mini-bar-chart builder (spec 012-virtual-columns §R-8).
 * Pure: no DOM-string parsing; uses document.createElementNS.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_WIDTH = 60;
const DEFAULT_HEIGHT = 16;
const BAR_GAP = 1;

/** Build the SVG for one row.
 *  values: parsed numeric values (null for missing/non-numeric).
 *  scaleMax: optional override for shared-scale rendering.
 */
export function buildSparklineSvg(
  values: Array<number | null>,
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT,
  scaleMax?: number,
): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const n = values.length;
  if (n === 0) return svg;

  const barW = Math.max(1, (width - BAR_GAP * (n - 1)) / n);
  // Determine row max for per-row scaling; shared scale overrides.
  const definedValues = values.filter((v): v is number => v !== null && isFinite(v));
  if (definedValues.length === 0) {
    // No values — return empty svg (renderer writes em-dash placeholder).
    return svg;
  }
  const localMax = Math.max(...definedValues.map((v) => Math.abs(v)));
  const max = scaleMax !== undefined ? scaleMax : localMax;
  const safeMax = max === 0 ? 1 : max;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    const x = i * (barW + BAR_GAP);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('width', String(barW));
    if (v === null || !isFinite(v)) {
      // Missing — render a 1px baseline marker for shape continuity.
      rect.setAttribute('y', String(height - 1));
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', '#ccc');
    } else if (safeMax === 1 && localMax === 0) {
      // All-zero row — flat baseline.
      rect.setAttribute('y', String(height - 1));
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', '#666');
    } else {
      const h = Math.max(1, (Math.abs(v) / safeMax) * height);
      rect.setAttribute('y', String(height - h));
      rect.setAttribute('height', String(h));
      rect.setAttribute('fill', '#4a90e2');
    }
    svg.appendChild(rect);
  }
  return svg;
}

function readSvgHeight(svg: SVGElement): number {
  const vb = svg.getAttribute('viewBox')?.split(' ')[3];
  return vb ? parseFloat(vb) : DEFAULT_HEIGHT;
}

function rebuildSparklineChildren(
  svg: SVGElement,
  values: Array<number | null>,
  scaleMax: number | undefined,
): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const fresh = buildSparklineSvg(values, undefined, undefined, scaleMax);
  while (fresh.firstChild) svg.appendChild(fresh.firstChild);
}

function setBaselineRect(rect: SVGRectElement | Element, height: number): void {
  rect.setAttribute('y', String(height - 1));
  rect.setAttribute('height', '1');
}

function setScaledRect(
  rect: SVGRectElement | Element,
  value: number,
  safeMax: number,
  height: number,
): void {
  const h = Math.max(1, (Math.abs(value) / safeMax) * height);
  rect.setAttribute('y', String(height - h));
  rect.setAttribute('height', String(h));
}

/** Update the SVG in place for a new value set / scaleMax.
 *  Reuses <rect> children when count matches; otherwise rebuilds. */
export function updateSparklineSvg(
  svg: SVGElement,
  values: Array<number | null>,
  scaleMax?: number,
): void {
  const rects = svg.querySelectorAll('rect');
  if (rects.length !== values.length) {
    rebuildSparklineChildren(svg, values, scaleMax);
    return;
  }
  const definedValues = values.filter((v): v is number => v !== null && isFinite(v));
  if (definedValues.length === 0) return;
  const height = readSvgHeight(svg);
  const localMax = Math.max(...definedValues.map((v) => Math.abs(v)));
  const safeMax = (scaleMax ?? localMax) || 1;
  values.forEach((v, i) => {
    const rect = rects[i];
    if (v === null || !isFinite(v) || localMax === 0) setBaselineRect(rect, height);
    else setScaledRect(rect, v, safeMax, height);
  });
}
