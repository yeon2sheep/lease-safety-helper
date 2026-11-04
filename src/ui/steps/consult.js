import { h } from '../dom.js';
import { resetState } from '../../state.js';

const TARGETS = {
  chatgpt: { label: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { label: 'Claude', url: 'https://claude.ai/new' },
  gemini: { label: 'Gemini', url: 'https://gemini.google.com/app' }
};

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // 클립보드 API가 막힌 환경용 대체
    const ta = h('textarea', {}); ta.value = text; document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

export function renderConsult(s, { rerender }) {
  return h('div', {},
    h('h2', {}, '5. Consult AI'),
    h('p.muted', {}, 'We never send anything to the AI for you. You paste the masked prompt yourself.'),
    h('div.row', {}, Object.entries(TARGETS).map(([id, t]) =>
      h('label.radio', {}, h('input', { type: 'radio', name: 'ai', checked: s.ui.aiTarget === id,
        onchange: () => { s.ui.aiTarget = id; rerender(); } }), ` ${t.label}`))),
    h('div.row', {},
      h('button.btn.primary', { onclick: async () => {
        // 팝업 차단을 피하려고 클릭 이벤트 안에서 먼저 새 탭을 연다
        const win = window.open(TARGETS[s.ui.aiTarget].url, '_blank');
        if (win) win.opener = null; // 새 탭이 원래 페이지에 접근하지 못하게 함
        s.ui.copied = await copy(s.prompt);
        if (!win) s.ui.popupBlocked = true;
        rerender();
      } }, 'Consult AI')),
    s.ui.copied ? h('p.success', {}, '✓ Prompt copied. Paste it into the chat.') : null,
    s.ui.popupBlocked ? h('p.warn', {}, 'The new tab was blocked. Please open the AI site yourself.') : null,
    h('hr'),
    h('button.btn.danger', { onclick: () => { if (confirm('Delete all files and results from memory?')) resetState(); } }, 'Start over')
  );
}
