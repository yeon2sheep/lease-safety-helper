// 브라우저 전용 pdf.js 로더: Vite가 worker 파일을 번들/복사하도록 ?url 로 가져온다.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractLines } from './pdfText.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** File 객체 → 줄 배열 (파일은 메모리에서만 읽고 어디에도 전송하지 않음) */
export async function readPdfFile(file) {
  const buf = await file.arrayBuffer();
  return extractLines(pdfjsLib, buf, { isEvalSupported: false });
}
