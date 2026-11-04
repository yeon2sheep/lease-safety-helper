// Node(Vitest)용 PDF 로더: pdf.js legacy build 사용, worker 없이 동작
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractLines } from '../src/core/pdfText.js';

const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));

export async function loadLines(file) {
  const data = await readFile(file);
  return extractLines(pdfjsLib, new Uint8Array(data), {
    cMapUrl: path.join(pdfjsDir, 'cmaps') + path.sep,
    cMapPacked: true,
    standardFontDataUrl: path.join(pdfjsDir, 'standard_fonts') + path.sep,
    disableFontFace: true
  });
}
