import { h } from './dom.js';

export const STEPS = ['Upload', 'Checklist', 'Purpose', 'Review', 'Consult AI'];

/** 단계 이동 조건 */
export function canGoTo(step, s) {
  if (step <= 0) return true;
  if (!s.checklist.length) return false;            // Run check 후
  if (step >= 3 && !s.purpose) return false;        // 목적 선택 후
  if (step >= 4 && !s.ui.reviewed) return false;    // 검토 확인 후
  return true;
}

export function renderStepper(el, s, goTo) {
  el.replaceChildren(
    ...STEPS.map((label, i) =>
      h(
        `button.step${i === s.ui.step ? '.active' : ''}${i < s.ui.step ? '.done' : ''}`,
        { onclick: () => goTo(i), disabled: !canGoTo(i, s) },
        h('span.num', {}, i + 1),
        h('span.label', {}, label)
      )
    )
  );
}
