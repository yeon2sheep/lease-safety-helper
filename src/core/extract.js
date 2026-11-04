// 샘플 PDF의 실제 항목명/줄 형식에 맞춘 값 추출. detect.js(민감정보)와 checklist.js(비교)가 함께 쓴다.
// 모든 위치는 { lineIndex, start, end } = lines 배열 인덱스 + 그 줄 text 안의 문자 위치.

const BIRTH_RE = /(\d{6})-(?:\d{7}|\*{7})/;

/** 정규식 match에서 캡처 그룹 n의 위치를 돌려준다(d 플래그 사용). */
function spanOf(m, group, lineIndex) {
  const [start, end] = m.indices[group];
  return { value: m[group], lineIndex, start, end };
}

// ───────────── 등기부 ─────────────
/**
 * 등기부(건물) 줄 → 사실 모음.
 * - 섹션: 【 갑 구 】 ~ 【 을 구 】 ~ "주요 등기사항 요약"(2쪽 요약표는 중복이라 제외)
 * - 기록: 줄이 "숫자 + 한글(등기목적)"으로 시작하면 새 기록, 다음 시작 줄 전까지 이어붙임
 */
export function registryFacts(lines) {
  const facts = { address: null, uniqueNo: null, hasGap: false, hasEul: false, records: [], owners: [] };
  let section = null;
  let cur = null;
  lines.forEach((l, i) => {
    const t = l.text;
    let m;
    if (!facts.address && (m = /^\[건물\]\s*(.+)$/d.exec(t))) facts.address = spanOf(m, 1, i);
    if (!facts.uniqueNo && (m = /고유번호\s*(\d{4}-\d{4}-\d{6})/d.exec(t))) facts.uniqueNo = spanOf(m, 1, i);

    if (/【\s*표\s*제\s*부\s*】/.test(t)) { section = null; cur = null; return; }
    if (/【\s*갑\s*구\s*】/.test(t)) { section = 'gap'; facts.hasGap = true; cur = null; return; }
    if (/【\s*을\s*구\s*】/.test(t)) { section = 'eul'; facts.hasEul = true; cur = null; return; }
    if (/주요\s*등기사항\s*요약/.test(t)) { section = null; cur = null; return; }
    if (!section) return;

    if ((m = /^(\d+)\s+([가-힣]+)/.exec(t))) {
      cur = { section, rank: Number(m[1]), purpose: m[2], text: t, lineIndexes: [i] };
      facts.records.push(cur);
    } else if (cur && !/^순위번호/.test(t)) {
      cur.text += ' ' + t;
      cur.lineIndexes.push(i);
    }
  });

  // "N번…말소" 기록이 있으면 N번 기록은 효력 없음
  const cancelled = new Set();
  for (const r of facts.records) {
    const m = /(\d+)번/.exec(r.purpose);
    if (/말소/.test(r.purpose) && m) cancelled.add(`${r.section}:${m[1]}`);
  }
  for (const r of facts.records) r.cancelled = /말소/.test(r.purpose) || cancelled.has(`${r.section}:${r.rank}`);

  // 소유자: 갑구 기록 줄의 "소유자 이름 생년월일-뒷자리"
  for (const r of facts.records.filter((x) => x.section === 'gap' && !x.cancelled)) {
    for (const i of r.lineIndexes) {
      const m = /소유자\s+(.+?)\s+(\d{6})-(?:\d{7}|\*{7})/d.exec(lines[i].text);
      if (m) facts.owners.push({ ...spanOf(m, 1, i), birth: m[2], rank: r.rank });
    }
  }
  facts.owners.forEach((o, k) => { o.current = k === facts.owners.length - 1; });

  facts.seizures = facts.records.filter((r) => r.section === 'gap' && !r.cancelled && /압류/.test(r.purpose));
  facts.mortgages = facts.records
    .filter((r) => r.section === 'eul' && !r.cancelled && /근저당/.test(r.purpose))
    .map((r) => {
      const m = /채권최고액\s*금?\s*([\d,]+)\s*원/.exec(r.text);
      return { rank: r.rank, amount: m ? Number(m[1].replace(/,/g, '')) : null };
    });
  return facts;
}

// ───────────── 계약서 ─────────────
/** 주택임대차표준계약서 줄 → 사실 모음 */
export function contractFacts(lines) {
  const facts = { landlordNames: [], landlord: null, tenantName: null, address: null, unit: null, accountHolder: null, deposit: null };
  const signers = []; // 서명란: 주민/외국인등록번호 줄 다음의 "성 명 X (인)" 줄
  lines.forEach((l, i) => {
    const t = l.text;
    let m;
    if (!facts.landlordNames.length && (m = /임대인\s*\(([^)]+)\)\s*과\s*임차인\s*\(([^)]+)\)/d.exec(t))) {
      facts.landlordNames.push(spanOf(m, 1, i));
      facts.tenantName = m[2];
    }
    if (!facts.address && (m = /^소\s*재\s*지\s+(.+)$/d.exec(t))) facts.address = spanOf(m, 1, i);
    if (!facts.unit && (m = /^임\s*차\s*할\s*부\s*분\s+(.+?)\s+면적/.exec(t))) facts.unit = m[1];
    if (!facts.accountHolder && (m = /예\s*금\s*주\s*[:：]?\s*([^()\s][^()]*?)\s*\)/d.exec(t))) facts.accountHolder = spanOf(m, 1, i);
    if (facts.deposit === null && (m = /^보\s*증\s*금\s+금\s*\S+?\s*\(([\d,]+)\s*원\)/.exec(t))) facts.deposit = Number(m[1].replace(/,/g, ''));
    if ((m = /^성\s*명\s+(.+?)\s*\(인\)\s*$/d.exec(t))) {
      let birth = null;
      for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
        const b = /^(?:주민|외국인)등록번호\s+(\d{6})-(?:\d{7}|\*{7})/.exec(lines[k].text);
        if (b) { birth = b[1]; break; }
      }
      signers.push({ ...spanOf(m, 1, i), birth });
    }
  });
  // 임대인 서명란 = 앞부분 "임대인(이름)"과 이름이 같은 서명란(없으면 첫 서명란)
  const first = facts.landlordNames[0]?.value;
  facts.landlord = signers.find((s) => s.value === first) ?? (first ? null : signers[0] ?? null);
  facts.signers = signers;
  return facts;
}

/** 주소 비교용 정규화: 괄호 내용/공백/'제'(숫자 앞) 제거 */
export const normAddress = (s) => s.replace(/\([^)]*\)/g, '').replace(/제(?=\d)/g, '').replace(/\s+/g, '');
