import './styles.css';
import { state, subscribe, notify } from './state.js';
import { renderLayout } from './ui/layout.js';
import { renderStepper, STEPS, canGoTo } from './ui/stepper.js';
import { renderUpload } from './ui/steps/upload.js';
import { renderChecklist } from './ui/steps/checklist.js';
import { renderPurpose } from './ui/steps/purpose.js';
import { renderReview } from './ui/steps/review.js';
import { renderConsult } from './ui/steps/consult.js';

const VIEWS = [renderUpload, renderChecklist, renderPurpose, renderReview, renderConsult];
const { stepperEl, mainEl, navEl } = renderLayout(document.getElementById('app'));

export function goTo(step) {
  if (step < 0 || step >= STEPS.length || !canGoTo(step, state)) return;
  state.ui.step = step;
  notify();
  window.scrollTo(0, 0);
}

function render() {
  renderStepper(stepperEl, state, goTo);
  mainEl.replaceChildren(VIEWS[state.ui.step](state, { goTo, rerender: notify }));
  // 이전/다음 버튼
  const s = state.ui.step;
  navEl.innerHTML = '';
  const prev = btn('← Previous', () => goTo(s - 1), s === 0);
  const next = btn('Next →', () => goTo(s + 1), s === STEPS.length - 1 || !canGoTo(s + 1, state));
  navEl.append(prev, next);
}

function btn(label, onClick, disabled) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = label;
  b.disabled = disabled;
  b.onclick = onClick;
  return b;
}

subscribe(render);
render();
