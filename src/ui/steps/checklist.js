import { h } from '../dom.js';
import { statusBadge } from '../components/badge.js';

const ORDER = { STOP: 0, CHECK: 1, UNABLE: 2, NO_ISSUES: 3 };

function itemCard(item) {
  return h(`article.card.item.item-${item.status.toLowerCase()}`, {},
    h('div.row', {}, statusBadge(item.status), h('h3', {}, item.title)),
    h('div.compare', {},
      item.compared.map((c) => h('div', {}, h('div.muted.small', {}, c.label), h('div.mono', {}, c.value ?? '—')))),
    h('p', {}, h('strong', {}, 'Why it matters: '), item.why),
    h('p', {}, h('strong', {}, 'What to do: '), item.todo),
    item.status === 'NO_ISSUES' ? h('p.muted.small', {}, 'Within the checked documents only. This does not guarantee safety.') : null,
    item.status === 'UNABLE' ? h('p.muted.small', {}, 'We could not read this item from your documents. Please check it yourself.') : null
  );
}

export function renderChecklist(s) {
  const items = [...s.checklist].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (st) => items.filter((i) => i.status === st).length;
  return h('div', {},
    h('h2', {}, '2. Checklist'),
    h('p.notice', {}, '⚠ Phase 1 preview: these results are placeholder data, not a real check.'),
    h('div.row.summary', {},
      ['STOP', 'CHECK', 'NO_ISSUES', 'UNABLE'].map((st) => h('span', {}, statusBadge(st), ` ${count(st)}`))),
    items.map(itemCard)
  );
}
