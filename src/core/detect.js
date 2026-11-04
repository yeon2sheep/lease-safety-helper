// [1차 더미] 민감정보 탐지. 2차에서 정규식 + 템플릿 항목 자리 규칙으로 교체.
// 반환 형식(Finding)은 2차와 동일하게 유지한다.
/**
 * @typedef {Object} Finding
 * @property {string} id
 * @property {'name'|'id_number'|'contact'|'account'|'registry_no'|'address'|'custom'} type
 * @property {string} value       원문 값
 * @property {'registry'|'contract'} source
 * @property {string} [role]      owner | landlord | tenant | agent | account_holder ...
 * @property {number} [page]
 * @property {number} [lineNo]
 * @property {boolean} enabled    false면 가리지 않음
 */

/** @returns {Finding[]} */
export function detectSensitive(_linesBySource) {
  // TODO(2차): 실제 탐지 구현. 지금은 화면 흐름 확인용 고정 예시.
  return [
    { id: 'f1', type: 'name', value: 'Kim (dummy)', source: 'registry', role: 'owner', enabled: true },
    { id: 'f2', type: 'id_number', value: '000000-0000000', source: 'contract', role: 'landlord', enabled: true },
    { id: 'f3', type: 'contact', value: '010-0000-0000', source: 'contract', enabled: true },
    { id: 'f4', type: 'account', value: '0000-000-000000', source: 'contract', enabled: true },
    { id: 'f5', type: 'registry_no', value: '0000-0000-000000', source: 'registry', enabled: true }
  ];
}
