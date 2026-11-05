// AI 상담 프롬프트: 목적별 추천 질문 + (체크리스트 포함 목적이면) 역할 범례·체크리스트 결과 + 가린 문서 + 영어 답변 요청.
import { PURPOSES, actionFor, addressParts } from './mask.js';
import { comparePeople } from './people.js';

const ROLE_TEXT = {
  owner: 'registered owner (registry)', previous_owner: 'previous owner (registry)',
  landlord: 'landlord (contract)', tenant: 'tenant (contract)',
  account_holder: 'rent account holder (contract)', broker: 'real estate agent (contract)'
};

/** 사용자가 이름 항목을 하나라도 켜 둔 인물만 가명을 쓴다 (전부 풀었으면 문서에도 이름이 보이므로) */
const activeGroups = (persons, findings) =>
  (persons?.groups ?? []).filter((g) => g.findingIds.some((id) => findings.find((f) => f.id === id)?.enabled));

function legendLines(groups) {
  return groups.map((g) => {
    // 이름이 같은 다른 묶음: 생년월일이 둘 다 있고 다르면 '다른 사람', 한쪽이 없으면 '불명확'
    const note = groups.filter((o) => o !== g && o.name === g.name).map((o) => comparePeople(g, o) === 'different'
      ? `; same name as ${o.pseudonym} but a different person (birth dates differ)`
      : `; same name as ${o.pseudonym}, unclear whether it is the same person (a birth date is missing)`).join('');
    return `${g.pseudonym} = ${g.roles.map((r) => ROLE_TEXT[r] ?? r).join(' and ')}${note}`;
  });
}

/** 체크리스트에 나온 이름·생년월일·주소·직접 추가 단어를 문서와 같은 방식으로 바꾼다 */
function maskCheckValue(value, label, item, { groups, findings, purpose, customWords }) {
  if (value === null || value === undefined) return 'not available';
  let out = value;
  // 1) "이름 (birth 800101)" 형태는 이름+생년월일이 같은 인물의 가명으로
  for (const g of groups) out = out.split(`${g.name} (${g.birth ? `birth ${g.birth}` : 'birth date not shown'})`).join(g.pseudonym);
  // 2) 이름만 있는 값: 동명이인이면 항목 이름(라벨)에 든 역할로 고른다
  const hint = /landlord/i.test(label) ? 'landlord' : /owner/i.test(label) ? 'owner' : /account holder/i.test(label) ? 'account_holder' : null;
  for (const name of [...new Set(groups.map((g) => g.name))].sort((a, b) => b.length - a.length)) {
    if (!out.includes(name)) continue;
    const c = groups.filter((g) => g.name === name);
    out = out.split(name).join(((hint && c.find((g) => g.roles.includes(hint))) || c[0]).pseudonym);
  }
  out = out.replace(/\s*\(birth[^)]*\)/g, '');
  // 3) 주소 항목은 문서와 같은 규칙으로
  const action = actionFor(purpose, 'address');
  if (item.ruleId === 'address_mismatch' && action !== 'keep' && findings.some((f) => f.type === 'address' && f.enabled)) {
    out = addressParts(out, action).map((p) => p.text).join('');
  }
  // 4) 직접 추가한 단어
  for (const w of customWords) if (w.value) out = out.replace(new RegExp(w.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), w.label || '[MASKED]');
  return out;
}

function checklistLines(s, groups) {
  const ctx = { groups, findings: s.findings ?? [], purpose: s.purpose, customWords: s.customWords ?? [] };
  return (s.checklist ?? [])
    .filter((c) => c.status === 'STOP' || c.status === 'CHECK')
    .map((c) => `- [${c.status}] ${c.title}\n  ` +
      c.compared.filter((x) => x.label !== '—').map((x) => `${x.label}: ${maskCheckValue(x.value, x.label, c, ctx)}`).join(' | '));
}

/** @param {object} s  state (purpose, maskedText, persons, checklist, findings, customWords) */
export function buildPrompt(s) {
  const p = PURPOSES[s.purpose];
  if (!p) return '';
  const parts = [
    `Purpose: ${p.label}`,
    'Questions:\n' + p.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  ];
  if (p.includeChecklist) {
    const groups = activeGroups(s.persons, s.findings ?? []);
    parts.push('Role legend:\n' + (legendLines(groups).join('\n') || '(none)'));
    parts.push('Check results (computed from the original documents; names replaced with pseudonyms):\n' +
      (checklistLines(s, groups).join('\n') || '(no problems found)'));
  }
  parts.push('Masked documents (items in [brackets] are masked placeholders):\n' + (s.maskedText ?? ''));
  parts.push('Please answer in English.');
  return parts.join('\n\n');
}