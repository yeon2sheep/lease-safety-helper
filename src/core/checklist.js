// 체크리스트: 규칙 문구는 src/rules/checklist.yaml, 판정은 아래 함수.
// 값을 못 읽으면 OK가 아니라 UNVERIFIED.
import yaml from 'js-yaml';
import rulesRaw from '../rules/checklist.yaml?raw';
import { registryFacts, contractFacts, normAddress } from './extract.js';
import { comparePeople } from './people.js';

export const RULES = yaml.load(rulesRaw);
export const STATUS = { STOP: 'STOP', CHECK: 'CHECK', OK: 'OK', UNVERIFIED: 'UNVERIFIED' };

/**
 * @typedef {Object} ChecklistItem
 * @property {string} ruleId
 * @property {'STOP'|'CHECK'|'OK'|'UNVERIFIED'} status
 * @property {string} title
 * @property {{label:string, value:string|null}[]} compared  비교한 두 값
 * @property {string} why
 * @property {string} action
 * @property {string} [note]
 */

const krw = (n) => (n === null || n === undefined ? null : `KRW ${n.toLocaleString('en-US')}`);
const personText = (p) => (p ? `${p.name} (${p.birth ? `birth ${p.birth}` : 'birth date not shown'})` : null);

/** 규칙 id → (사실, 규칙) => { status, a, b }  (status 없이 a/b만 주면 UNVERIFIED) */
const CHECKS = {
  owner_vs_landlord({ reg, con }, rule) {
    const owner = reg.owners.find((o) => o.current);
    const owp = owner && { name: owner.value, birth: owner.birth };
    const lp = con.landlord && { name: con.landlord.value, birth: con.landlord.birth };
    const a = personText(owp), b = personText(lp);
    if (!owp || !lp) return { a, b };
    const r = comparePeople(owp, lp);
    return { a, b, status: r === 'same' ? STATUS.OK : r === 'different' ? rule.level : STATUS.CHECK };
  },
  address_mismatch({ reg, con }, rule) {
    const a = reg.address?.value ?? null;
    const b = con.address ? [con.address.value, con.unit].filter(Boolean).join(' ') : null;
    if (!a || !b) return { a, b };
    return { a, b, status: normAddress(a) === normAddress(b) ? STATUS.OK : rule.level };
  },
  account_holder({ con }, rule) {
    // 계좌 예금주에는 생년월일이 없으므로 이름만 비교한다.
    const a = con.accountHolder?.value ?? null;
    const b = con.landlord?.value ?? con.landlordNames[0]?.value ?? null;
    if (!a || !b) return { a, b };
    return { a, b, status: a === b ? STATUS.OK : rule.level };
  },
  seizure({ reg }, rule) {
    if (!reg.hasGap) return { a: null, b: null };
    if (!reg.seizures.length) return { a: 'No active seizure entries', b: null, status: STATUS.OK };
    const a = `${reg.seizures.length} active: ` + reg.seizures.map((r) => `#${r.rank} ${r.purpose}`).join(', ');
    return { a, b: null, status: rule.level };
  },
  mortgage({ reg, con }, rule) {
    const dep = krw(con.deposit);
    if (!reg.hasEul) return { a: null, b: dep };
    if (!reg.mortgages.length) return { a: 'No active mortgage entries', b: dep, status: STATUS.OK };
    const known = reg.mortgages.filter((m) => m.amount !== null);
    const total = known.reduce((s, m) => s + m.amount, 0);
    const a = known.length ? krw(total) + (reg.mortgages.length > 1 ? ` (${reg.mortgages.length} mortgages)` : '') : 'Amount not readable';
    return { a, b: dep, status: rule.level };
  }
};

/** @returns {ChecklistItem[]} */
export function runChecklist(state) {
  const facts = {
    reg: registryFacts(state.lines?.registry ?? []),
    con: contractFacts(state.lines?.contract ?? [])
  };
  return RULES.map((r) => {
    const base = { ruleId: r.id, title: r.title, why: r.why, action: r.action };
    const labels = r.compare;
    const run = r.auto === false ? null : CHECKS[r.id];
    const res = run ? run(facts, r) : { a: null, b: null };
    const note = r.auto === false ? r.note : undefined;
    return {
      ...base,
      status: res.status ?? STATUS.UNVERIFIED,
      compared: [{ label: labels[0], value: res.a ?? null }, { label: labels[1], value: res.b ?? null }],
      ...(note ? { note } : {})
    };
  });
}
