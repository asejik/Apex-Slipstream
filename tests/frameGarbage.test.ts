import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf-8');

/** The body of `name(...)` in `source`, up to the method's closing brace at the same indent */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, signature).toBeGreaterThan(-1);
  const end = source.indexOf('\n  }\n', start);
  return source.slice(start, end);
}

describe('No per-frame layout reads or lookups in the route map (P15-09)', () => {
  const miniMap = read('src/ui/MiniMap.ts');
  const update = methodBody(miniMap, 'public update(');

  it('never reads the page layout while drawing a frame', () => {
    // clientWidth/Height or getBoundingClientRect force a layout right after the HUD changed text
    expect(update).not.toMatch(/clientWidth|clientHeight|getBoundingClientRect|offsetWidth|getComputedStyle/);
    expect(update).toMatch(/const shown = this\.displayedWidth;/);
  });

  it('colours the dots from a table made once, not a search per car per frame', () => {
    expect(update).not.toMatch(/teamColourFor\(/);
    expect(update).toMatch(/this\.carColours\.get\(car\.profile\.id\)/);
    expect(update).not.toMatch(/=>/); // no closures made per frame
  });

  it('keeps the size up to date without reading it per frame', () => {
    expect(miniMap).toMatch(/new ResizeObserver\(/);
    expect(read('src/main.ts')).toMatch(/if \(to === 'racing'\) this\.miniMap\.refreshSize\(\);/);
  });
});
