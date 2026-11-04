// [1차 더미] 인물 묶기. 2차: Fuse.js 이름 유사도 + 생년월일(앞 6자리)로 최종 판정.
import Fuse from 'fuse.js';

/**
 * @returns {{groups:{pseudonym:string, role:string, findingIds:string[]}[],
 *            ambiguous:{a:string, b:string, reason:string}[]}}
 */
export function groupPersons(findings) {
  const names = findings.filter((f) => f.type === 'name');
  // Fuse 인스턴스만 만들어 둔다(2차에서 search 결과로 후보를 묶음)
  const _fuse = new Fuse(names, { keys: ['value'], threshold: 0.3, includeScore: true });
  const groups = names.map((f, i) => ({
    pseudonym: `[${cap(f.role || 'Person')}_${String.fromCharCode(65 + i)}]`,
    role: f.role || 'person',
    findingIds: [f.id]
  }));
  // TODO(2차): 생년월일이 한쪽에만 있는 경우 등 애매한 쌍을 채움
  return { groups, ambiguous: [] };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
