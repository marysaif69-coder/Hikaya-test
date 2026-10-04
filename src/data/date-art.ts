// Drawings of one date (viewBox -26 -46 52 92): plain, stuffed (opened lengthwise with the filling
// in the middle) or dipped (coated from one end). Used on the Dates tab and in the box drawings.
import type { FillingId } from './products';

const BODY = 'M-2 -42c13 0 22 12 22 40c0 27-9 44-22 44c-12 0-21-15-21-43c0-29 8-41 21-41z';
const LINES = 'M-12 -18q6 3 11 0M-14 4q7 4 14 0M-11 24q6 3 12-1M4 -30q5 2 9-1';
// The filling's colour, and the bits on top (chopped pistachio, a cashew, biscuit crumbs).
const FILL: Record<FillingId, { c: string; bits: string }> = {
  pistachio: { c: '#93AE52', bits: '#5F7F2E' },
  'pistachio-dipped': { c: '#93AE52', bits: '#5F7F2E' },
  biscuit: { c: '#C08A4E', bits: '#8A5A2B' },
  cashew: { c: '#EFE2C2', bits: '#D6C298' },
  'caramel-almond': { c: '#C58A3E', bits: '#F0DDB8' },
};

export function dateSvg(c: string, filling?: FillingId | null) {
  const body = `<path fill="${c}" d="${BODY}"/>`;
  if (!filling) return body + `<path d="${LINES}" stroke="#33211A" stroke-opacity=".3" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const f = FILL[filling];
  if (filling === 'pistachio-dipped') {
    // Coated from the top end down, with a drip line and crushed pistachio on the coat.
    return body + `<path d="M-14 22q6 3 12-1" stroke="#33211A" stroke-opacity=".3" stroke-width="2" fill="none" stroke-linecap="round"/>`
      + `<path fill="${f.c}" d="M-22.6 -2c0-28 8.6-40 20.6-40c13 0 22 12 22 38c-5 3-9 0-13 3s-8 4-12 1s-9 1-17.6-2z"/>`
      + [[-9, -28], [3, -32], [9, -20], [-4, -16], [-14, -12], [12, -8], [1, -6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${f.bits}"/>`).join('');
  }
  // Opened lengthwise: the cut edges, the filling in the middle, and a few pieces on top.
  const bits = filling === 'cashew'
    ? `<path d="M-4 -22c-5 4-5 12 0 15c3 2 6 0 5-3c-2-1-3-4-1-6c1-2 0-5-4-6z" fill="${f.bits}"/>`
    : [[-2, -24], [1, -12], [-3, 0], [1, 12], [-2, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${f.bits}"/>`).join('');
  return body + `<path d="M-1 -36c-11 10-11 62 0 74c11-12 11-64 0-74z" fill="#5A2E16" opacity=".55"/>`
    + `<path d="M-1 -32c-8 10-8 56 0 66c8-10 8-56 0-66z" fill="${f.c}"/>` + bits;
}
