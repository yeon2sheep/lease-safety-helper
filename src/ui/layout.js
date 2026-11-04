import { h } from './dom.js';

export function renderLayout(root) {
  const stepperEl = h('nav.stepper');
  const mainEl = h('main.content');
  const navEl = h('div.step-nav');
  root.append(
    h('div.banner', {}, '🔒 Your files are processed in your browser and never uploaded.'),
    h('header.header', {}, h('h1', {}, 'Lease Check Helper'), stepperEl),
    mainEl,
    navEl,
    h('footer.footer', {}, 'This is not legal advice. Please make the final decision yourself.')
  );
  return { stepperEl, mainEl, navEl };
}
