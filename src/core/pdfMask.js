// [1차 제외] 마스킹 PDF 생성. 2차: 페이지를 이미지로 렌더 → 상자/가명 그림 → pdf-lib로 새 PDF, 메타데이터 비움.
import { PDFDocument } from 'pdf-lib';

export async function createMaskedPdf() {
  // 패키지 연결 확인용: 빈 문서 객체만 만들고 아직 내보내지 않음
  await PDFDocument.create();
  throw new Error('Masked PDF export is not implemented yet (coming in phase 2).');
}
