# Lease Check Helper (외국인 유학생 자취방 계약 안전 도우미) — Phase 1 skeleton

A static, browser-only web app that reads a Korean property registry (등기사항전부증명서) and a
standard lease contract (주택임대차표준계약서), runs a pre-signing checklist, masks personal data
by purpose, and hands a masked prompt to an AI chat. **No server, no LLM API. Files never leave the browser.**

## Phase 1 scope
| Area | Status |
|---|---|
| PDF text extraction (pdf.js) + coordinate-based line rebuilding | ✅ implemented |
| Document type detection (YAML keyword count) | ✅ implemented + tested |
| Extracted-text debug view | ✅ implemented |
| 5-step UI flow (Upload → Checklist → Purpose → Review → Consult AI) | ✅ implemented |
| Sensitive data detection / person grouping / checklist / masking / prompt | 🟡 dummy functions in `src/core/` |
| Masked PDF export (pdf-lib) | ⛔ phase 2 (`src/core/pdfMask.js` stub) |
| OCR (images) | ⛔ phase 2 (`ocr/README.md`) |

## Run
```bash
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest: classifies the 4 sample PDFs
npm run build   # static output in dist/ (GitHub Pages)
```

## Structure
- `src/core/` — logic only (no DOM). Replace dummy functions in phase 2 without touching UI.
  - `pdfText.js` extraction + line rebuilding (shared by browser & tests)
  - `pdfLoader.browser.js` pdf.js worker setup for Vite (`?url` import)
  - `classify.js`, `templates.js` + `src/templates/*.yaml`
  - `detect.js`, `persons.js`, `checklist.js`, `mask.js`, `prompt.js`, `pdfMask.js`
- `src/rules/` — `checklist-rules.yaml` (titles / why / what to do), `masking-rules.json` (purpose × data type)
- `src/ui/` — stepper, layout, step screens, components
- `src/state.js` — single global state (`files, docType, lines, findings, checklist, purpose, maskedText`)
- `tests/` — Vitest + sample PDFs (all fictional data)

## Open-source libraries
| Library | Use | License |
|---|---|---|
| [pdfjs-dist](https://github.com/mozilla/pdf.js) 4.10.38 | PDF text + coordinates | Apache-2.0 |
| [fuse.js](https://github.com/krisk/Fuse) | Fuzzy name matching (person grouping) | Apache-2.0 |
| [js-yaml](https://github.com/nodeca/js-yaml) | Templates & checklist rules | MIT |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Masked PDF export (phase 2) | MIT |
| [Vite](https://github.com/vitejs/vite) | Dev server / build | MIT |
| [Vitest](https://github.com/vitest-dev/vitest) | Unit tests | MIT |
| Tesseract.js / OpenCV.js (planned) | OCR / image correction | Apache-2.0 |

Reference only (no code copied): ko-pii, prompt-anonymizer, llm-pii-redact.

## Notices
- This is not legal advice. Results only cover the uploaded documents.
- Sample PDFs in `tests/fixtures/` are fictional test documents.

## License
MIT — see [LICENSE](LICENSE).
