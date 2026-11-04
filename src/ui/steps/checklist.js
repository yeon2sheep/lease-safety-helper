import { h } from '../dom.js';
import { statusBadge, cssKey } from '../components/badge.js';

const ORDER = { STOP: 0, CHECK: 1, UNVERIFIED: 2, OK: 3 };

function itemCard(item) {
  return h(`article.card.item.item-${cssKey(item.status)}`, {},
    h('div.row', {}, statusBadge(item.status), h('h3', {}, item.title)),
    h('div.compare', {},
      item.compared.map((c) => h('div', {}, h('div.muted.small', {}, c.label), h('div.mono', {}, c.value ?? '—')))),
    h('p', {}, h('strong', {}, 'Why it matters: '), item.why),
    h('p', {}, h('strong', {}, 'What to do: '), item.action),
    item.status === 'OK' ? h('p.muted.small', {}, 'Based only on the documents you uploaded. This is not a guarantee.') : null,
    item.status === 'UNVERIFIED' ? h('p.muted.small', {}, item.note ?? 'We could not read this item from your documents. Please check it yourself.') : null
  );
}

export function renderChecklist(s) {
  const items = [...s.checklist].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (st) => items.filter((i) => i.status === st).length;
  return h('div', {},
    h('h2', {}, '2. Checklist'),
    h('div.row.summary', {},
      ['STOP', 'CHECK', 'OK', 'UNVERIFIED'].map((st) => h('span', {}, statusBadge(st), ` ${count(st)}`))),
    items.map(itemCard)
  );
}
