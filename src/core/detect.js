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
  { type: 'registry_no', re: /고유번호\s*(\d{4}-\d{4}-\d{6})/dg, group: 1 },
  // 금액: "30,000,000원", "금 삼천만원정"의 한글 금액
  { type: 'amount', re: /\d{1,3}(?:,\d{3})+\s*원/dg, group: 0 },
  { type: 'amount', re: /금\s*([일이삼사오육칠팔구십백천만억]+원)정/dg, group: 1 }
];

// 주소: 항목 자리 규칙이 못 잡는 줄(서명란, 요약표, 줄바꿈으로 갈라진 도로명)용.
const CITY = '(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)';
const ADDRESS_RE =
  new RegExp(`${CITY}\\s+[가-힣]+[시군구](?:\\s+[가-힣]+구)?(?:\\s+[가-힣0-9]+(?:로|길|동)(?:\\s*\\d+(?:-\\d+)?)?)?(?:\\s+[가-힣]+빌라)?(?:,?\\s*제?\\d+(?:층|호))*(?:\\s*\\([가-힣]+동\\s*[\\d-]+\\))?`, 'dg');

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
      // 임대인이 아닌 서명란 = 임차인(앞부분 "임차인(이름)"과 같으면 tenant)
      for (const s of f.signers.filter((x) => x !== f.landlord)) add(docType, 'name', s, { role: s.value === f.tenantName ? 'tenant' : 'signer', birth: s.birth });
      lines.forEach((l, lineIndex) => {
        let m;
        if ((m = /^대\s*표\s+(.+?)\s*\(인\)/d.exec(l.text))) add(docType, 'name', { value: m[1], lineIndex, start: m.indices[1][0], end: m.indices[1][1] }, { role: 'broker', birth: null });
        if ((m = /^임\s*차\s*할\s*부\s*분\s+(.+?)\s+면적/d.exec(l.text))) add(docType, 'address', { value: m[1], lineIndex, start: m.indices[1][0], end: m.indices[1][1] });
      });
    }

    // 3) 주소 패턴: 이미 잡힌 범위와 겹치면 건너뜀
    const addAddress = (re) => lines.forEach((l, lineIndex) => {
      for (const m of l.text.matchAll(re)) {
        const [start, end] = m.indices[0];
        if (out.some((x) => x.docType === docType && x.lineIndex === lineIndex && start < x.end && x.start < end)) continue;
        add(docType, 'address', { value: m[0], lineIndex, start, end });
      }
    });
    addAddress(ADDRESS_RE);
    // 4) 줄바꿈으로 시·구와 갈라진 "새싹로 45": 같은 문서에서 이미 확인된 도로명만 단독으로 다시 찾는다
    const roads = new Set(out.filter((x) => x.docType === docType && x.type === 'address')
      .map((x) => /(?:^|\s)([가-힣0-9]+(?:로|길))(?=\s*\d)/.exec(x.value)?.[1]).filter(Boolean));
    if (roads.size) addAddress(new RegExp(`(?:${[...roads].join('|')})\\s*\\d+(?:-\\d+)?`, 'dg'));
  }
  // 문서 순서대로 id 부여 (같은 문서 안에서는 줄/위치 순)
  out.sort((a, b) => (a.docType === b.docType ? a.lineIndex - b.lineIndex || a.start - b.start : a.docType === 'registry' ? -1 : 1));
  out.forEach((f, i) => { f.id = `f${i + 1}`; });
  return out;
}