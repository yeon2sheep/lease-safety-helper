// [1차 더미] 목적 기반 마스킹. 2차: masking-rules.json 규칙(hide/pseudonym/district_only) 실제 적용.
import maskingRules from '../rules/masking-rules.json';

export const PURPOSES = maskingRules.purposes;

/**
 * @returns {{text:string, spans:{start:number,end:number,token:string}[]}}
 *   text: 가린 결과, spans: 미리보기 하이라이트 위치
 */
export function applyMask(linesBySource, findings, purposeId, customWords = []) {
  const body = ['registry', 'contract']
    .filter((k) => linesBySource[k])
    .map((k) => `=== ${k.toUpperCase()} ===\n` + linesBySource[k].map((l) => l.text).join('\n'))
    .join('\n\n');
  // TODO(2차): 목적별 규칙 적용. 지금은 켜진 항목/추가 단어를 단순 치환만 함.
  const rule = PURPOSES[purposeId]?.rules ?? {};
  const targets = [
    ...findings.filter((f) => f.enabled).map((f) => ({ v: f.value, token: tokenFor(f, rule) })),
    ...customWords.map((w) => ({ v: w, token: '[MASKED]' }))
  ].filter((t) => t.v);
  let text = body;
  for (const t of targets) text = text.split(t.v).join(t.token);
  const spans = [];
  const re = /\[[A-Za-z_]+(?:_[A-Z])?\]/g;
  let m;
  while ((m = re.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length, token: m[0] });
  return { text, spans };
}

function tokenFor(f, rule) {
  if (f.type === 'name' && rule.name === 'pseudonym') return `[${(f.role || 'Person').replace(/^./, (c) => c.toUpperCase())}_A]`;
  return `[${f.type.toUpperCase()}]`;
}
