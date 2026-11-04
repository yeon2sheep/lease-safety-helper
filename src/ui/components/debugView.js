import { h } from '../dom.js';

/** 추출 텍스트 디버그 화면: 페이지/줄 번호/y좌표/텍스트 */
export function debugView(lines, classifyResult) {
  if (!lines) return h('p.muted', {}, 'No text yet.');
  if (!lines.length) return h('p.warn', {}, 'No text layer found. This may be a scanned/image PDF (OCR support coming soon).');
  const info = classifyResult
    ? h('div.debug-info', {},
        `Keyword hits — ${Object.entries(classifyResult.scores).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
        h('br'),
        `Matched: ${Object.values(classifyResult.hits).flat().join(', ') || '(none)'}`)
    : null;
  const table = h('table.debug', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Page'), h('th', {}, 'Line'), h('th', {}, 'y'), h('th', {}, 'Text'))),
    h('tbody', {}, lines.map((l) => h('tr', {}, h('td', {}, l.page), h('td', {}, l.lineNo), h('td', {}, l.y), h('td.mono', {}, l.text))))
  );
  return h('div', {}, info, h('div.debug-wrap', {}, table));
}
