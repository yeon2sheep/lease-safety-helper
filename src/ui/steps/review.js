import { h } from '../dom.js';
import { applyMask, isMasked, actionFor, PURPOSES } from '../../core/mask.js';
import { buildPrompt } from '../../core/prompt.js';

const DOCS = [['registry', 'Registry'], ['contract', 'Lease Contract']];
const TYPE_LABEL = { name: 'name', address: 'address', id_number: 'ID number', contact: 'phone', account: 'account', registry_no: 'registry no.', amount: 'amount' };

/** 마스킹·프롬프트를 state에서 다시 계산 (목적·체크박스·추가 단어가 바뀔 때마다 호출됨) */
function recompute(s) {
  const r = applyMask(s.lines, s.findings, s.purpose, s.customWords);
  s.maskedText = r.text;
  s.maskedDocs = r.docs;
  s.maskLeaks = r.leaks;
  s.prompt = buildPrompt(s);
  return r;
}

/** 가린 부분: 검은 박스(hide) / 노란 하이라이트(가명·직접 지정 라벨) */
function preview(s, doc) {
  const out = [];
  let pos = 0;
  for (const sp of doc.spans) {
    out.push(doc.text.slice(pos, sp.start), h(sp.kind === 'pseudo' ? 'mark.pseudo' : 'span.mask-box', {}, sp.token));
    pos = sp.end;
  }
  out.push(doc.text.slice(pos));
  const pre = h('pre.preview', {}, out);
  pre.addEventListener('scroll', () => { s.ui.previewScroll = pre.scrollTop; });
  queueMicrotask(() => { pre.scrollTop = s.ui.previewScroll; }); // 화면이 다시 그려져도 스크롤 위치 유지
  return pre;
}

export function renderReview(s, { rerender }) {
  const r = recompute(s);
  const change = () => { s.ui.reviewed = false; rerender(); };
  const p = PURPOSES[s.purpose];

  // 목적 바꾸기: 바로 미리보기·프롬프트에 반영
  const purposeBar = h('div.card', {},
    h('div.row', {}, h('strong', {}, 'Purpose:'),
      Object.entries(PURPOSES).map(([id, x]) =>
        h(`button.btn${s.purpose === id ? '.primary' : ''}`, { onclick: () => { s.purpose = id; change(); } }, x.label))),
    h('p.small.muted', {}, `${p.keeps}. ${p.hides}.`));

  // 문서 탭
  const tabs = h('div.tabs', {}, DOCS.map(([id, label]) =>
    h(`button.tab${s.ui.previewTab === id ? '.active' : ''}`,
      { onclick: () => { s.ui.previewTab = id; s.ui.previewScroll = 0; rerender(); } },
      `${label} (${s.maskedDocs[id]?.spans.length ?? 0} masked)`)));
  const doc = s.maskedDocs[s.ui.previewTab] ?? s.maskedDocs.registry;

  // 탐지 항목: 이 목적에서 실제로 가려지는 것만. 체크 해제 = 그 항목은 가리지 않음
  const shown = s.findings.filter((f) => isMasked(f, s.purpose));
  const list = h('div.findings', {},
    shown.length ? shown.map((f) => h('label.check', {},
      h('input', { type: 'checkbox', checked: f.enabled, onchange: (e) => { f.enabled = e.target.checked; change(); } }),
      h('span', {}, h('span.tag', {}, TYPE_LABEL[f.type] ?? f.type), ' ', h('span.mono', {}, f.value),
        actionFor(s.purpose, f.type) === 'pseudonym' && f.pseudonym ? h('span.muted', {}, ` → ${f.pseudonym}`) : null,
        h('span.muted.small', {}, ` ${f.docType === 'registry' ? 'Registry' : 'Contract'}`)))
    ) : h('p.muted', {}, 'No items detected.'));

  // 직접 추가: [Value to mask] [Replace with (optional label)] [Add]
  const valueIn = h('input.text', { placeholder: 'Value to mask' });
  const labelIn = h('input.text', { placeholder: 'Replace with (optional label)' });
  const add = () => {
    const value = valueIn.value.trim();
    if (!value || s.customWords.some((w) => w.value === value)) return;
    s.customWords.push({ value, label: labelIn.value.trim() });
    change();
  };
  [valueIn, labelIn].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); }));
  const custom = h('div.custom', {},
    h('div.row', {}, valueIn, labelIn, h('button.btn', { onclick: add }, 'Add')),
    s.customWords.map((w, i) => h('div.check', {},
      h('span.tag', {}, 'custom'), ' ', h('span.mono', {}, w.value), h('span.muted', {}, ` → ${w.label || '[MASKED]'}`),
      h('span.muted.small', {}, r.customHits[w.value] ? ` ${r.customHits[w.value]} found` : ' not found in the documents'),
      h('button.link', { onclick: () => { s.customWords.splice(i, 1); change(); } }, 'remove'))));

  // 모호한 인물 묶기 확인 UI 자리 (이번 범위 밖)
  const ambiguous = s.persons.ambiguous.length
    ? h('div.card.ambiguous', {}, h('h4', {}, 'Are these the same person?'),
        s.persons.ambiguous.map((x) => h('div.row', {}, `${x.a} ↔ ${x.b}`, h('span.muted.small', {}, x.reason),
          h('button.btn', {}, 'Same person'), h('button.btn', {}, 'Different people'))))
    : null;

  const legend = s.persons.groups.length
    ? h('ul', {}, s.persons.groups.map((g) => h('li', {}, h('mark.pseudo', {}, g.pseudonym), ` = ${g.role}`)))
    : h('p.muted', {}, 'No role pseudonyms.');

  return h('div', {},
    h('h2', {}, '4. Review before sending'),
    purposeBar,
    h('div.grid-review', {},
      h('section.card', {}, h('h3', {}, 'Masked preview'), tabs, preview(s, doc)),
      h('section.card', {},
        h('h3', {}, 'Detected items'),
        h('p.small.muted', {}, 'Uncheck an item to leave it visible.'),
        list,
        h('h4', {}, 'Add a word to mask'),
        custom,
        ambiguous
      )
    ),
    r.leaks.length ? h('p.warn', {}, `⚠ Some hidden values still appear in the text: ${r.leaks.join(', ')}`) : null,
    h('details.card', { open: s.ui.legendOpen, ontoggle: (e) => { s.ui.legendOpen = e.target.open; } },
      h('summary', {}, 'Role legend'), legend),
    h('details.card', { open: s.ui.promptOpen, ontoggle: (e) => { s.ui.promptOpen = e.target.open; } },
      h('summary', {}, 'Generated prompt preview'), h('pre.preview', {}, s.prompt)),
    h('div.row', {},
      h('button.btn', { disabled: true }, 'Download masked PDF'), h('span.muted', {}, 'Coming soon')),
    h('label.check.confirm', {},
      h('input', { type: 'checkbox', checked: s.ui.reviewed, onchange: (e) => { s.ui.reviewed = e.target.checked; rerender(); } }),
      ' I reviewed the masked result')
  );
}