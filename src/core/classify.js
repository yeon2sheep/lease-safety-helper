// 문서 판별: 템플릿 인식단어가 몇 개 나오는지 세어 가장 많은 템플릿을 고른다.
import { TEMPLATES } from './templates.js';

/** 공백 제거(PDF는 '갑 구', '보 증 금'처럼 글자 사이 공백이 흔함) */
export const normalize = (s) => s.replace(/\s+/g, '');

/**
 * @param {{text:string}[]} lines
 * @returns {{docType:'registry'|'contract'|'unknown', scores:object, hits:object}}
 */
export function classifyDocument(lines, templates = TEMPLATES) {
  const full = normalize(lines.map((l) => l.text).join('\n'));
  const scores = {};
  const hits = {};
  for (const t of templates) {
    hits[t.id] = t.keywords.filter((k) => full.includes(normalize(k)));
    scores[t.id] = hits[t.id].length;
  }
  const ranked = templates
    .filter((t) => scores[t.id] >= (t.minHits ?? 1))
    .sort((a, b) => scores[b.id] - scores[a.id]);
  const best = ranked[0];
  // 동점이면 판별 불가로 둔다
  if (!best || (ranked[1] && scores[ranked[1].id] === scores[best.id])) {
    return { docType: 'unknown', scores, hits };
  }
  return { docType: best.id, scores, hits };
}
