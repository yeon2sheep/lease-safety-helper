import { h } from '../dom.js';
import { PURPOSES } from '../../core/mask.js';

export function renderPurpose(s, { rerender }) {
  return h('div', {},
    h('h2', {}, '3. What do you want to ask the AI?'),
    h('p.muted', {}, 'We hide only what is not needed for your question.'),
    h('div.grid3', {},
      Object.entries(PURPOSES).map(([id, p]) =>
        h(`button.card.purpose${s.purpose === id ? '.selected' : ''}`, {
          onclick: () => { s.purpose = id; s.ui.reviewed = false; rerender(); }
        },
          h('h3', {}, p.label),
          h('p.small', {}, h('strong', {}, 'What stays / What is hidden: '), `${p.keeps}. ${p.hides}.`)
        ))
    )
  );
}
