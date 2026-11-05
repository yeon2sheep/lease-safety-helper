import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadLines } from './loadPdfNode.js';
import { detectSensitive } from '../src/core/detect.js';
import { groupPeople, attachPseudonyms } from '../src/core/people.js';
import { runChecklist } from '../src/core/checklist.js';
import { applyMask } from '../src/core/mask.js';
import { buildPrompt } from '../src/core/prompt.js';

const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

async function promptFor(purpose, reg = 'risky_registry.pdf', con = 'risky_contract.pdf') {
  const lines = { registry: (await loadLines(fx(reg))).lines, contract: (await loadLines(fx(con))).lines };
  const s = { lines, purpose, customWords: [] };
  s.findings = detectSensitive(lines);
  s.persons = groupPeople(s.findings);
  attachPseudonyms(s.findings, s.persons.groups);
  s.checklist = runChecklist(s);
  s.maskedText = applyMask(lines, s.findings, purpose, s.customWords).text;
  return buildPrompt(s);
}

describe('prompt', () => {
  it('fraud_risk: questions + role legend + pseudonymized check results + masked docs, ends with the English request', async () => {
    const p = await promptFor('fraud_risk');
    expect(p.trimEnd().endsWith('Please answer in English.')).toBe(true);
    expect(p).toContain('Role legend:');
    expect(p).toContain('[STOP] Registered owner and landlord do not match');
    expect(p).toMatch(/Registry owner \(name \+ birth date\): \[Owner_[A-Z]+\] \| Contract landlord \(name \+ birth date\): \[Landlord_[A-Z]+\]/);
    expect(p).toContain('=== REGISTRY ===');
    expect(p).toContain('=== CONTRACT ===');
    // 체크리스트 결과를 포함해 프롬프트 어디에도 원래 이름·생년월일·번지가 없다
    for (const secret of ['김철수', '정대현', 'TRAN THI MAI', '800101', '750315', '새싹로']) expect(p).not.toContain(secret);
  });

  it('other purposes: no role legend / check results', async () => {
    for (const purpose of ['explain_terms', 'contract_conditions']) {
      const p = await promptFor(purpose);
      expect(p).not.toContain('Role legend:');
      expect(p).not.toContain('Check results');
      expect(p.trimEnd().endsWith('Please answer in English.')).toBe(true);
    }
  });

  it('the recommended questions differ by purpose', async () => {
    const [a, b] = [await promptFor('explain_terms'), await promptFor('contract_conditions')];
    expect(a).not.toBe(b);
    expect(a).toContain('structure of these two documents');
    expect(b).toContain('special terms');
  });
});