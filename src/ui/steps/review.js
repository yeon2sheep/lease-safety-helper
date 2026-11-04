import { h } from '../dom.js';
import { applyMask } from '../../core/mask.js';
import { buildPrompt } from '../../core/prompt.js';

/** 마스킹/프롬프트를 state에서 다시 계산 */
function recompute(s) {
  const { text, spans } = applyMask(s.lines, s.findings, s.purpose, s.customWords);
  s.maskedText = text;
  s.maskSpans = spans;
  s.prompt = buildPrompt(s);
}

function preview(text, spans) {
  const out = [];
  let pos = 0;
  for (const sp of spans) {
    out.push(text.slice(pos, sp.start), h('mark.pseudo', {}, sp.token));
    pos = sp.end;
  }
  out.push(text.slice(pos));
  return h('pre.preview', {}, out);
}

export function renderReview(s, { rerender }) {
  recompute(s);
  const change = () => { s.ui.reviewed = false; rerender(); };

  const list = h('div.findings', {},
    s.findings.length ? s.findings.map((f) =>
      h('label.check', {},
        h('input', { type: 'checkbox', checked: f.enabled, onchange: (e) => { f.enabled = e.target.checked; change(); } }),
        h('span', {}, h('span.tag', {}, f.type), ' ', h('span.mono', {}, f.value), f.role ? h('span.muted', {}, ` (${f.role})`) : null)
      )) : h('p.muted', {}, 'No items detected.'),
    s.customWords.map((w, i) => h('div.check', {}, h('span.tag', {}, 'custom'), ' ', h('span.mono', {}, w),
      h('button.link', { onclick: () => { s.customWords.splice(i, 1); change(); } }, 'remove')))
  );

  const input = h('input.text', { placeholder: 'Add a word to mask' });
  const addBtn = h('button.btn', { onclick: () => {
    const w = input.value.trim();
    if (w && !s.customWords.includes(w)) { s.customWords.push(w); change(); }
  } }, 'Add');

  // 모호한 인물 묶기 확인 UI 자리
  const ambiguous = s.persons.ambiguous.length
    ? h('div.card.ambiguous', {}, h('h4', {}, 'Are these the same person?'),
        s.persons.ambiguous.map((p) => h('div.row', {}, `${p.a} ↔ ${p.b}`, h('span.muted.small', {}, p.reason),
          h('button.btn', {}, 'Same person'), h('button.btn', {}, 'Different people'))))
    : h('div.placeholder.small.muted', {}, 'Are these the same person? — no unclear matches (phase 1 placeholder).');

  const legend = s.persons.groups.length
    ? h('ul', {}, s.persons.groups.map((g) => h('li', {}, h('mark.pseudo', {}, g.pseudonym), ` = ${g.role}`)))
    : h('p.muted', {}, 'No role pseudonyms.');

  return h('div', {},
    h('h2', {}, '4. Review before sending'),
    h('div.grid-review', {},
      h('section.card', {}, h('h3', {}, 'Masked preview'), preview(s.maskedText, s.maskSpans)),
      h('section.card', {},
        h('h3', {}, 'Detected items'),
        h('p.small.muted', {}, 'Uncheck an item to leave it visible.'),
        list,
        h('div.row', {}, input, addBtn),
        ambiguous
      )
    ),
    h('details.card', {}, h('summary', {}, 'Role legend'), legend),
    h('details.card', {}, h('summary', {}, 'Generated prompt preview'), h('pre.preview', {}, s.prompt)),
    h('div.row', {},
      h('button.btn', { disabled: true }, 'Download masked PDF'), h('span.muted', {}, 'Coming soon')),
    h('label.check.confirm', {},
      h('input', { type: 'checkbox', checked: s.ui.reviewed, onchange: (e) => { s.ui.reviewed = e.target.checked; rerender(); } }),
      ' I reviewed the masked result')
  );
}
