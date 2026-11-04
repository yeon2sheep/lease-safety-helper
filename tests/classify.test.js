import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadLines } from './loadPdfNode.js';
import { classifyDocument } from '../src/core/classify.js';

const fixture = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

const CASES = [
  ['sample_registry.pdf', 'registry'],
  ['risky_registry.pdf', 'registry'],
  ['sample_contract.pdf', 'contract'],
  ['risky_contract.pdf', 'contract']
];

describe('document classification (4 sample PDFs)', () => {
  it.each(CASES)('%s → %s', async (file, expected) => {
    const { lines } = await loadLines(fixture(file));
    expect(lines.length).toBeGreaterThan(5);
    const result = classifyDocument(lines);
    expect(result.docType).toBe(expected);
  });

  it('returns unknown for unrelated text', () => {
    expect(classifyDocument([{ text: 'hello world' }]).docType).toBe('unknown');
  });
});

describe('line rebuilding', () => {
  it('keeps key labels readable after whitespace normalization', async () => {
    const { lines } = await loadLines(fixture('risky_registry.pdf'));
    const joined = lines.map((l) => l.text.replace(/\s+/g, '')).join('\n');
    expect(joined).toContain('갑구');
    expect(joined).toContain('소유자');
  });
});
