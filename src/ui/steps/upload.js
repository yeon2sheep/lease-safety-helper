import { h } from '../dom.js';
import { debugView } from '../components/debugView.js';
import { readPdfFile } from '../../core/pdfLoader.browser.js';
import { classifyDocument } from '../../core/classify.js';
import { detectSensitive } from '../../core/detect.js';
import { groupPeople, attachPseudonyms } from '../../core/people.js';
import { runChecklist } from '../../core/checklist.js';

const SLOTS = [
  { key: 'registry', title: 'Property Registry', hint: '등기사항전부증명서' },
  { key: 'contract', title: 'Lease Contract', hint: '주택임대차표준계약서' }
];
const TYPE_LABEL = { registry: 'Registry', contract: 'Lease Contract', unknown: 'Unknown document' };

async function handleFile(s, key, file, rerender) {
  s.ui.errors[key] = null;
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
    s.ui.errors[key] = 'Please upload a PDF file.';
    return rerender();
  }
  s.files[key] = file;
  s.lines[key] = null;
  s.docType[key] = null;
  s.checklist = []; // 파일이 바뀌면 이전 결과 무효화
  s.ui.loading = key;
  rerender();
  try {
    const { lines } = await readPdfFile(file);
    s.lines[key] = lines;
    s.docType[key] = classifyDocument(lines);
  } catch (e) {
    s.ui.errors[key] = `Could not read this PDF: ${e.message}`;
    s.files[key] = null;
  }
  s.ui.loading = null;
  rerender();
}

function slotView(s, slot, rerender) {
  const input = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true,
    onchange: (e) => handleFile(s, slot.key, e.target.files[0], rerender) });
  const drop = h('div.dropzone', {
      ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
      ondragleave: () => drop.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); handleFile(s, slot.key, e.dataTransfer.files[0], rerender); },
      onclick: () => input.click()
    },
    s.files[slot.key] ? h('strong', {}, `📄 ${s.files[slot.key].name}`) : 'Drag & drop a PDF here, or click to choose a file',
    input
  );

  const det = s.docType[slot.key];
  const badge = det ? h(`span.badge.${det.docType === slot.key ? 'badge-info' : 'badge-check'}`, {}, `Detected: ${TYPE_LABEL[det.docType]}`) : null;
  const mismatch = det && det.docType !== slot.key
    ? h('p.warn', {}, det.docType === 'unknown'
        ? '⚠ We could not identify this document. Please check that you uploaded the right file.'
        : `⚠ This looks like a ${TYPE_LABEL[det.docType]}, not a ${slot.title}. Did you put it in the wrong slot?`)
    : null;

  const open = s.ui[`debug_${slot.key}`];
  const toggle = s.lines[slot.key]
    ? h('button.link', { onclick: () => { s.ui[`debug_${slot.key}`] = !open; rerender(); } }, open ? 'Hide extracted text' : 'View extracted text')
    : null;

  return h('section.card.slot', {},
    h('h3', {}, slot.title, ' ', h('small.muted', {}, slot.hint)),
    drop,
    s.ui.loading === slot.key ? h('p.muted', {}, 'Reading PDF…') : null,
    s.ui.errors[slot.key] ? h('p.error', {}, s.ui.errors[slot.key]) : null,
    h('div.row', {}, badge, toggle),
    mismatch,
    open ? debugView(s.lines[slot.key], det) : null
  );
}

export function renderUpload(s, { goTo, rerender }) {
  const ready = s.lines.registry && s.lines.contract;
  const run = h('button.btn.primary', {
    disabled: !ready,
    onclick: () => {
      s.findings = detectSensitive(s.lines);
      s.persons = groupPeople(s.findings);
      attachPseudonyms(s.findings, s.persons.groups);
      s.checklist = runChecklist(s);
      goTo(1);
    }
  }, 'Run check');

  return h('div', {},
    h('h2', {}, '1. Upload your documents'),
    h('p.muted', {}, 'Upload the property registry and the lease contract as text PDFs.'),
    h('div.grid2', {}, SLOTS.map((slot) => slotView(s, slot, rerender))),
    h('div.row', {},
      h('button.btn', { disabled: true }, '📷 Upload photo'),
      h('span.muted', {}, 'Photo/screenshot support coming soon')),
    h('div.row.end', {}, run)
  );
}
