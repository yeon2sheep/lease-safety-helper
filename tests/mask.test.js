import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadLines } from './loadPdfNode.js';
import { detectSensitive } from '../src/core/detect.js';
import { groupPeople, attachPseudonyms } from '../src/core/people.js';
import { applyMask, findLeaks } from '../src/core/mask.js';

const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));
const PURPOSES = ['explain_terms', 'fraud_risk', 'contract_conditions'];
// risky 샘플에 실제로 들어 있는 주민/외국인등록번호·연락처·계좌·고유번호·이름
const SECRETS = [
  '750315-1234567', '020304-6123456', '800101-*******', '650807-*******',
  '010-0000-3333', '010-0000-4444', '2003-456-789012', '1101-2012-000001',
  '김철수', '정대현', '박정훈', 'TRAN THI MAI', '최미란'
];

async function setup(reg = 'risky_registry.pdf', con = 'risky_contract.pdf') {
  const lines = { registry: (await loadLines(fx(reg))).lines, contract: (await loadLines(fx(con))).lines };
  const findings = detectSensitive(lines);
  attachPseudonyms(findings, groupPeople(findings).groups);
  return { lines, findings };
}

describe('masking by purpose', () => {
  it.each(PURPOSES)('%s: no original ID number or name remains', async (purpose) => {
    const { lines, findings } = await setup();
    const r = applyMask(lines, findings, purpose, []);
    expect(findLeaks(r.text, SECRETS)).toEqual([]);
    expect(r.leaks).toEqual([]);
  });

  it('replaces by range: every span in the preview text is the token that was inserted', async () => {
    const { lines, findings } = await setup();
    const r = applyMask(lines, findings, 'fraud_risk', []);
    for (const doc of Object.values(r.docs)) {
      expect(doc.spans.length).toBeGreaterThan(0);
      for (const sp of doc.spans) expect(doc.text.slice(sp.start, sp.end)).toBe(sp.token);
    }
  });

  it('changing the purpose changes the result', async () => {
    const { lines, findings } = await setup();
    const t = Object.fromEntries(PURPOSES.map((p) => [p, applyMask(lines, findings, p, []).text]));
    expect(new Set(Object.values(t)).size).toBe(3);
    // 금액: explain_terms만 가림
    expect(t.explain_terms).not.toContain('30,000,000원');
    expect(t.fraud_risk).toContain('30,000,000원');
    expect(t.contract_conditions).toContain('30,000,000원');
    // 이름: fraud_risk만 역할 가명, 나머지는 [NAME]
    expect(t.fraud_risk).toContain('[Landlord_');
    expect(t.explain_terms).toContain('[NAME]');
    expect(t.fraud_risk).not.toContain('[NAME]');
    // 주소: fraud_risk만 시·구까지 남기고 도로명·번지·호수를 가림
    expect(t.fraud_risk).toContain('서울특별시 한빛구');
    expect(t.fraud_risk).not.toContain('새싹로');
    expect(t.fraud_risk).not.toContain('201호');
    expect(t.contract_conditions).not.toContain('서울특별시 한빛구');
  });

  it('an unchecked finding is not masked', async () => {
    const { lines, findings } = await setup();
    const holder = findings.find((f) => f.role === 'account_holder');
    expect(applyMask(lines, findings, 'fraud_risk', []).text).not.toContain('정대현');
    holder.enabled = false;
    const r = applyMask(lines, findings, 'fraud_risk', []);
    expect(r.text).toContain('정대현');
    expect(r.text).not.toContain('2003-456-789012'); // 다른 항목은 그대로 가려짐
  });

  it('unchecking one occurrence of a name leaves only that occurrence visible', async () => {
    const { lines, findings } = await setup();
    const count = (r) => r.docs.contract.text.split('김철수').length - 1;
    expect(count(applyMask(lines, findings, 'explain_terms', []))).toBe(0);
    const sign = findings.find((f) => f.docType === 'contract' && f.value === '김철수' && lines.contract[f.lineIndex].text.startsWith('성 명'));
    sign.enabled = false;
    expect(count(applyMask(lines, findings, 'explain_terms', []))).toBe(1);
  });

  it('custom words: replaced with the label (or [MASKED]) and counted', async () => {
    const { lines, findings } = await setup();
    const r = applyMask(lines, findings, 'contract_conditions', [
      { value: '한빛공인중개사사무소', label: '[AGENCY]' }, { value: '푸른신용협동조합', label: '' }, { value: 'nothing-here', label: '' }
    ]);
    expect(r.text).toContain('[AGENCY]');
    expect(r.text).toContain('[MASKED]');
    expect(r.text).not.toContain('한빛공인중개사사무소');
    expect(r.customHits['한빛공인중개사사무소']).toBe(1);
    expect(r.customHits['nothing-here']).toBeUndefined();
  });
});

describe('leak check', () => {
  it('findLeaks reports values that are still in the text', () => {
    expect(findLeaks('owner is 김철수 and [NAME]', ['김철수', '정대현'])).toEqual(['김철수']);
    expect(findLeaks('[NAME] [ID_NUMBER]', ['김철수', '750315-1234567'])).toEqual([]);
  });
});