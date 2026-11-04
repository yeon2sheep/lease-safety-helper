// 인물 묶기: 이름 + 생년월일(앞 6자리)로 같은 사람/다른 사람/불명확(ambiguous)을 판정하고 역할 가명을 붙인다.

/** 역할 → 가명 접두어 */
const ROLE_LABEL = { owner: 'Owner', previous_owner: 'PrevOwner', landlord: 'Landlord', account_holder: 'Holder' };

/**
 * @param {{name:string,birth?:string|null}} a
 * @param {{name:string,birth?:string|null}} b
 * @returns {'same'|'different'|'ambiguous'}
 */
export function comparePeople(a, b) {
  if (!a?.name || !b?.name || a.name !== b.name) return 'different';
  if (a.birth && b.birth) return a.birth === b.birth ? 'same' : 'different';
  if (!a.birth && !b.birth) return 'same'; // 같은 글자가 반복된 것으로 본다(구별할 정보가 없음)
  return 'ambiguous'; // 한쪽에만 생년월일이 있음
}

const letter = (n) => String.fromCharCode(65 + (n % 26)).repeat(Math.floor(n / 26) + 1);
const cap = (s) => s.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());

/**
 * @param {Finding[]} findings  type==='name' 항목만 사용 (name=value, birth, role)
 * @returns {{groups:{pseudonym:string, role:string, roles:string[], name:string, birth:string|null, findingIds:string[]}[],
 *            ambiguous:{a:string, b:string, reason:string}[]}}
 */
export function groupPeople(findings) {
  const people = []; // 서로 다른 사람
  for (const f of findings.filter((x) => x.type === 'name')) {
    const p = { name: f.value, birth: f.birth ?? null };
    const hit = people.find((g) => comparePeople(g, p) === 'same');
    if (hit) {
      hit.findingIds.push(f.id);
      if (!hit.roles.includes(f.role)) hit.roles.push(f.role);
      hit.birth ??= p.birth;
    } else {
      people.push({ ...p, roles: [f.role || 'person'], findingIds: [f.id] });
    }
  }
  const groups = people.map((g, i) => ({
    pseudonym: `[${ROLE_LABEL[g.roles[0]] ?? cap(g.roles[0])}_${letter(i)}]`,
    role: g.roles.join(' + '),
    roles: g.roles,
    name: g.name,
    birth: g.birth,
    findingIds: g.findingIds
  }));
  const ambiguous = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (comparePeople(groups[i], groups[j]) === 'ambiguous') {
        ambiguous.push({ a: groups[i].pseudonym, b: groups[j].pseudonym,
          reason: 'Same name, but a birth date is missing on one side.' });
      }
    }
  }
  return { groups, ambiguous };
}

/** 가명을 각 name 항목에 달아준다(마스킹이 이 값을 쓴다). */
export function attachPseudonyms(findings, groups) {
  for (const g of groups) for (const id of g.findingIds) {
    const f = findings.find((x) => x.id === id);
    if (f) f.pseudonym = g.pseudonym;
  }
  return findings;
}
