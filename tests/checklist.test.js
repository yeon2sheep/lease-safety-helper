import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadLines } from './loadPdfNode.js';
import { detectSensitive } from '../src/core/detect.js';
import { groupPeople, comparePeople } from '../src/core/people.js';
import { runChecklist } from '../src/core/checklist.js';

const fx = (n) => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

async function run(reg, con) {
  const lines = { registry: (await loadLines(fx(reg))).lines, contract: (await loadLines(fx(con))).lines };
  const findings = detectSensitive(lines);
  const persons = groupPeople(findings);
  const checklist = runChecklist({ lines, findings, persons });
  return { findings, persons, checklist, byId: Object.fromEntries(checklist.map((c) => [c.ruleId, c])) };
}

describe('matching pair (sample_registry + sample_contract)', () => {
  it('owner = landlord, no STOP', async () => {
    const { byId, checklist, persons } = await run('sample_registry.pdf', 'sample_contract.pdf');
    expect(byId.owner_vs_landlord.status).toBe('OK');
    expect(checklist.filter((c) => c.status === 'STOP')).toEqual([]);
    // 소유자와 임대인은 같은 사람 → 같은 가명
    const g = persons.groups.find((x) => x.roles.includes('landlord') && x.roles.includes('owner'));
    expect(g).toBeTruthy();
  });
  it('by-design UNVERIFIED rules stay UNVERIFIED', async () => {
    const { byId } = await run('sample_registry.pdf', 'sample_contract.pdf');
    for (const id of ['trust', 'recent_transfer', 'risky_clause']) expect(byId[id].status).toBe('UNVERIFIED');
  });
});

describe('risky pair (risky_registry + risky_contract)', () => {
  it('same name, different birth date → owner ≠ landlord STOP', async () => {
    const { byId, persons } = await run('risky_registry.pdf', 'risky_contract.pdf');
    expect(byId.owner_vs_landlord.status).toBe('STOP');
    expect(byId.owner_vs_landlord.compared.map((c) => c.value)).toEqual(['김철수 (birth 800101)', '김철수 (birth 750315)']);
    const kim = persons.groups.filter((g) => g.name === '김철수');
    expect(kim).toHaveLength(2);
    expect(kim[0].pseudonym).not.toBe(kim[1].pseudonym);
  });
  it('other rules fire from the documents', async () => {
    const { byId } = await run('risky_registry.pdf', 'risky_contract.pdf');
    expect(byId.account_holder.status).toBe('STOP');
    expect(byId.seizure.status).toBe('STOP');
    expect(byId.mortgage.status).toBe('CHECK');
    expect(byId.mortgage.compared.map((c) => c.value)).toEqual(['KRW 180,000,000', 'KRW 30,000,000']);
    expect(byId.address_mismatch.status).toBe('OK');
  });
});

describe('no hardcoded results / no unread-as-OK', () => {
  it('empty input → every item UNVERIFIED, no findings', () => {
    const lines = { registry: [{ text: 'hello' }], contract: [{ text: 'world' }] };
    expect(detectSensitive(lines)).toEqual([]);
    expect(runChecklist({ lines }).every((c) => c.status === 'UNVERIFIED')).toBe(true);
  });
  it('output never contains the word "safe"', async () => {
    const { checklist } = await run('sample_registry.pdf', 'sample_contract.pdf');
    expect(JSON.stringify(checklist).toLowerCase()).not.toContain('safe');
  });
});

describe('comparePeople', () => {
  it('same / different / ambiguous', () => {
    expect(comparePeople({ name: 'A', birth: '1' }, { name: 'A', birth: '1' })).toBe('same');
    expect(comparePeople({ name: 'A', birth: '1' }, { name: 'A', birth: '2' })).toBe('different');
    expect(comparePeople({ name: 'A', birth: '1' }, { name: 'A', birth: null })).toBe('ambiguous');
  });
});

describe('detection on samples', () => {
  it('finds id numbers, phones, account, registry no with positions', async () => {
    const lines = { registry: (await loadLines(fx('risky_registry.pdf'))).lines, contract: (await loadLines(fx('risky_contract.pdf'))).lines };
    const f = detectSensitive(lines);
    const vals = (t, d) => f.filter((x) => x.type === t && x.docType === d).map((x) => x.value);
    expect(vals('registry_no', 'registry')).toEqual(['1101-2012-000001']);
    expect(vals('account', 'contract')).toEqual(['2003-456-789012']);
    expect(vals('id_number', 'contract')).toEqual(['750315-1234567', '020304-6123456']);
    expect(vals('contact', 'contract')).toContain('010-0000-3333');
    expect(f.filter((x) => x.role === 'account_holder').map((x) => x.value)).toEqual(['정대현']);
    for (const x of f) expect(lines[x.docType][x.lineIndex].text.slice(x.start, x.end)).toBe(x.value);
  });
});
