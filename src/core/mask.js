// 목적별 마스킹. 규칙표는 src/rules/purposes.json, 치환은 탐지 결과의 범위(lineIndex, start, end) 기준.
// 규칙 값: hide(유형 토큰) | pseudonym(역할 가명) | district_only(시·구(동)만 남김) | keep(그대로)
import cfg from '../rules/purposes.json';

export const PURPOSES = cfg.purposes;
const ALWAYS_HIDE = new Set(cfg.alwaysHide); // 어떤 목적에서도 가림 (JSON에서 빠뜨려도 가려짐)
const DOCS = ['registry', 'contract'];

/** 목적 + 정보 유형 → 규칙. 표에 없는 유형은 가리는 쪽이 기본값. */
export function actionFor(purposeId, type) {
  if (ALWAYS_HIDE.has(type)) return 'hide';
  return PURPOSES[purposeId]?.rules?.[type] ?? 'hide';
}

// ───────────── 주소 ─────────────
const HEAD_RE = /^\S+?(?:특별시|광역시|특별자치시|특별자치도|도)\s+\S+?[시군구](?:\s+\S+?구)?/;

/** 주소 한 덩어리 → 조각들. mask:true 조각만 가려진 부분. district_only는 시·구(동)만 남긴다. */
export function addressParts(value, action) {
  if (action !== 'district_only') return [{ text: '[ADDRESS]', mask: true, orig: value }];
  const head = HEAD_RE.exec(value);
  if (!head) return [{ text: '[ADDRESS_DETAIL]', mask: true, orig: value }]; // 시·구를 못 읽으면 전부 가림
  const rest = value.slice(head[0].length);
  if (!rest.trim()) return [{ text: value, mask: false }];                   // 시·구만 있는 주소는 그대로
  const dong = /([가-힣0-9]+동)(?![가-힣])/.exec(rest);
  return [
    { text: `${head[0]}${dong ? ' ' + dong[1] : ''} `, mask: false },
    { text: '[ADDRESS_DETAIL]', mask: true, orig: rest.trim() }
  ];
}

/** 이 목적에서 이 탐지 항목이 실제로 가려지는가? (검토 화면 목록용) */
export function isMasked(f, purposeId) {
  const action = actionFor(purposeId, f.type);
  if (action === 'keep') return false;
  return f.type === 'address' ? addressParts(f.value, action).some((p) => p.mask) : true;
}

function partsFor(f, purposeId) {
  const action = actionFor(purposeId, f.type);
  if (action === 'keep') return null;
  if (f.type === 'address') return addressParts(f.value, action);
  if (action === 'pseudonym' && f.pseudonym) return [{ text: f.pseudonym, mask: true, pseudo: true, orig: f.value }];
  return [{ text: `[${f.type.toUpperCase()}]`, mask: true, orig: f.value }];
}

// ───────────── 누출 검사 ─────────────
/** 가려졌어야 할 원래 값 중 결과 텍스트에 아직 남은 것을 돌려준다. */
export function findLeaks(text, values) {
  return [...new Set(values)].filter((v) => v && v.length >= 2 && text.includes(v));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {{registry?:{text:string}[], contract?:{text:string}[]}} linesBySource
 * @param {Finding[]} findings   enabled=false 인 항목은 가리지 않는다
 * @param {string} purposeId
 * @param {{value:string,label?:string}[]} customWords  직접 추가한 단어 (label 없으면 [MASKED])
 * @returns {{text:string, docs:Object, leaks:string[], customHits:Object}}
 *   docs[docType] = { text, spans:[{start,end,token,kind:'hide'|'pseudo'}] }  (미리보기 하이라이트용)
 *   text = 프롬프트용 합본, leaks = 가렸어야 하는데 남은 원래 값
 */
export function applyMask(linesBySource, findings, purposeId, customWords = []) {
  const docs = {};
  const hidden = [];
  const customHits = {};
  const enabled = findings.filter((f) => f.enabled);
  const userKept = new Set(findings.filter((f) => !f.enabled).map((f) => f.value)); // 사용자가 직접 푼 값

  for (const docType of DOCS) {
    const lines = linesBySource?.[docType];
    if (!lines) continue;
    const ops = lines.map(() => []);
    const add = (li, start, end, parts) => {
      if (ops[li].some((o) => start < o.end && o.start < end)) return;  // 겹치면 먼저 들어온 것 우선
      ops[li].push({ start, end, parts });
    };

    // 1) 탐지 결과를 범위 기준으로 치환 (긴 범위 먼저)
    const mine = enabled.filter((f) => f.docType === docType).sort((a, b) => (b.end - b.start) - (a.end - a.start));
    for (const f of mine) {
      const parts = partsFor(f, purposeId);
      if (parts) add(f.lineIndex, f.start, f.end, parts);
    }

    // 2) 이름이 탐지 범위 밖의 줄에 또 나오면(영수자·채무자·요약표 등) 같은 토큰으로 가린다.
    //    사용자가 해제한 탐지 범위는 건드리지 않는다. 같은 문서의 항목을 우선 쓴다(동명이인 구분).
    const seen = new Set();
    const names = [...mine, ...enabled.filter((f) => f.docType !== docType)].filter((f) => {
      if (f.type !== 'name' || f.value.length < 2 || seen.has(f.value)) return false;
      return seen.add(f.value), true;
    });
    for (const f of names) {
      const parts = partsFor(f, purposeId);
      if (!parts) continue;
      lines.forEach((l, li) => {
        for (const m of l.text.matchAll(new RegExp(escapeRe(f.value), 'g'))) {
          const s = m.index, e = s + m[0].length;
          const owned = findings.some((x) => x.docType === docType && x.lineIndex === li && s < x.end && x.start < e);
          if (!owned) add(li, s, e, parts);
        }
      });
    }

    // 3) 직접 추가한 단어: 사용자가 직접 요청한 것이라 해제된 탐지 범위 안에서도 적용
    for (const w of customWords) {
      if (!w.value) continue;
      const parts = [{ text: w.label || '[MASKED]', mask: true, pseudo: !!w.label, orig: w.value }];
      lines.forEach((l, li) => {
        for (const m of l.text.matchAll(new RegExp(escapeRe(w.value), 'gi'))) {
          customHits[w.value] = (customHits[w.value] ?? 0) + 1;
          add(li, m.index, m.index + m[0].length, parts);
        }
      });
    }

    // 4) 줄별로 이어 붙이며 가려진 위치(spans)를 기록
    let text = '';
    const spans = [];
    lines.forEach((l, li) => {
      let pos = 0;
      for (const o of ops[li].sort((a, b) => a.start - b.start)) {
        text += l.text.slice(pos, o.start);
        for (const p of o.parts) {
          if (p.mask) {
            spans.push({ start: text.length, end: text.length + p.text.length, token: p.text, kind: p.pseudo ? 'pseudo' : 'hide' });
            hidden.push(p.orig);
          }
          text += p.text;
        }
        pos = o.end;
      }
      text += l.text.slice(pos) + (li < lines.length - 1 ? '\n' : '');
    });
    docs[docType] = { text, spans };
  }

  const text = DOCS.filter((d) => docs[d]).map((d) => `=== ${d.toUpperCase()} ===\n${docs[d].text}`).join('\n\n');
  const leaks = findLeaks(text, hidden.filter((v) => !userKept.has(v)));
  return { text, docs, leaks, customHits };
}