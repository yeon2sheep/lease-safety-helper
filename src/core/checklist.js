// 체크리스트: 규칙 메타데이터는 YAML, 판정 로직은 [1차 더미].
import yaml from 'js-yaml';
import rulesRaw from '../rules/checklist-rules.yaml?raw';

export const RULES = yaml.load(rulesRaw);
export const STATUS = { STOP: 'STOP', CHECK: 'CHECK', OK: 'NO_ISSUES', UNKNOWN: 'UNABLE' };

/**
 * @typedef {Object} ChecklistItem
 * @property {string} ruleId
 * @property {'STOP'|'CHECK'|'NO_ISSUES'|'UNABLE'} status
 * @property {string} title
 * @property {{label:string, value:string|null}[]} compared  비교한 두 값
 * @property {string} why
 * @property {string} todo
 */

/** @returns {ChecklistItem[]} */
export function runChecklist(_state) {
  // TODO(2차): 원본 값으로 실제 비교. 지금은 4가지 상태를 모두 보여주는 더미 값.
  const dummy = {
    owner_vs_landlord: ['STOP', 'Name A (born 1980)', 'Name A (born 1975)'],
    seizure: ['STOP', '2 entries (dummy)', null],
    address_mismatch: ['NO_ISSUES', 'Same address (dummy)', 'Same address (dummy)'],
    trust: ['NO_ISSUES', 'None found (dummy)', null],
    account_holder: ['STOP', 'Holder B (dummy)', 'Landlord A (dummy)'],
    mortgage: ['CHECK', 'KRW 180,000,000 (dummy)', 'KRW 30,000,000 (dummy)'],
    recent_transfer: ['CHECK', '2026-09-18 (dummy)', '2026-11-06 (dummy)'],
    risky_clause: ['UNABLE', null, null]
  };
  return RULES.map((r) => {
    const [status, a, b] = dummy[r.id] ?? ['UNABLE', null, null];
    return {
      ruleId: r.id,
      status,
      title: r.title,
      compared: [
        { label: r.compare[0], value: a },
        { label: r.compare[1], value: b }
      ],
      why: r.why,
      todo: r.todo
    };
  });
}
