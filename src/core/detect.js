// 민감정보 탐지: 정규식 + 샘플의 항목명 자리 규칙(직접 작성).
// 결과: { type, value, docType, lineIndex, start, end } (+ UI 호환용 id/source/enabled/role/birth)
import { registryFacts, contractFacts } from './extract.js';

// 정규식 규칙. group = 값으로 쓸 캡처 그룹(0이면 전체). d 플래그로 그룹 위치를 얻는다.
const PATTERNS = [
  // 주민/외국인등록번호: 앞 6자리-뒤 7자리 또는 뒷자리 가림(*******)
  { type: 'id_number', re: /\d{6}-(?:[1-8]\d{6}|\*{7})/dg, group: 0 },
  // 전화번호: 010-0000-0000, 02-0000-0000
  { type: 'contact', re: /\b0\d{1,2}-\d{3,4}-\d{4}\b/dg, group: 0 },
  // 계좌번호: "계좌" 라벨 뒤(은행명이 있으면 건너뜀)의 하이픈 숫자열
  { type: 'account', re: /계좌\s*[:：]?\s*(?:\S+\s+)?(\d{2,6}(?:-\d{2,8}){1,3})/dg, group: 1 },
  // 등기 고유번호: "고유번호 1101-2012-000001"
  { type: 'registry_no', re: /고유번호\s*(\d{4}-\d{4}-\d{6})/dg, group: 1 }
];

/**
 * @param {{registry?:{text:string}[], contract?:{text:string}[]}} linesBySource
 * @returns {Finding[]}  Finding = { id, type, value, docType, source, lineIndex, start, end, enabled, role?, birth? }
 */
export function detectSensitive(linesBySource) {
  const out = [];
  const add = (docType, type, span, extra = {}) =>
    out.push({ id: '', type, value: span.value, docType, source: docType,
      lineIndex: span.lineIndex, start: span.start, end: span.end, enabled: true, ...extra });

  for (const docType of ['registry', 'contract']) {
    const lines = linesBySource?.[docType];
    if (!lines) continue;

    // 1) 정규식
    lines.forEach((l, lineIndex) => {
      for (const p of PATTERNS) {
        for (const m of l.text.matchAll(p.re)) {
          const [start, end] = m.indices[p.group];
          add(docType, p.type, { value: m[p.group], lineIndex, start, end });
        }
      }
    });

    // 2) 항목 자리 규칙
    if (docType === 'registry') {
      const f = registryFacts(lines);
      if (f.address) add(docType, 'address', f.address);
      f.owners.forEach((o) => add(docType, 'name', o, { role: o.current ? 'owner' : 'previous_owner', birth: o.birth }));
    } else {
      const f = contractFacts(lines);
      if (f.address) add(docType, 'address', f.address);
      const birth = f.landlord?.birth ?? null;
      for (const s of [...f.landlordNames, ...(f.landlord ? [f.landlord] : [])]) add(docType, 'name', s, { role: 'landlord', birth });
      if (f.accountHolder) add(docType, 'name', f.accountHolder, { role: 'account_holder', birth: null });
    }
  }
  // 문서 순서대로 id 부여 (같은 문서 안에서는 줄/위치 순)
  out.sort((a, b) => (a.docType === b.docType ? a.lineIndex - b.lineIndex || a.start - b.start : a.docType === 'registry' ? -1 : 1));
  out.forEach((f, i) => { f.id = `f${i + 1}`; });
  return out;
}
