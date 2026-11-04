// 전역 state 하나로 단계 간 데이터를 주고받는다.
const initial = () => ({
  files: { registry: null, contract: null },          // File 객체 (메모리에만 존재)
  docType: { registry: null, contract: null },        // 판별 결과 {docType, scores, hits}
  lines: { registry: null, contract: null },          // 재구성된 줄 배열
  findings: [],                                       // 탐지 항목 (detect.js)
  persons: { groups: [], ambiguous: [] },             // 인물 묶기 (persons.js)
  checklist: [],                                      // 체크리스트 결과 (checklist.js)
  purpose: null,                                      // 'explain_terms' | 'fraud_risk' | 'contract_conditions'
  maskedText: '',
  maskSpans: [],
  customWords: [],
  prompt: '',
  ui: { step: 0, reviewed: false, aiTarget: 'chatgpt', copied: false, errors: {} }
});

export const state = initial();

const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);
export const notify = () => listeners.forEach((fn) => fn(state));

/** Start over: 파일·결과를 모두 메모리에서 제거 */
export function resetState() {
  const fresh = initial();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh);
  notify();
}
