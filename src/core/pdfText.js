// pdf.js 텍스트 추출 + 좌표 기반 줄 재구성 (브라우저/Node 공용)
// pdfjsLib는 호출하는 쪽에서 주입한다 (브라우저: pdfLoader.browser.js, 테스트: legacy build).

/** 같은 줄로 볼 y 좌표 허용 오차(글자 높이 대비 비율) */
const LINE_TOLERANCE_RATIO = 0.5;
/** 단어 사이 공백을 넣을 x 간격 기준(글자 높이 대비 비율) */
const SPACE_GAP_RATIO = 0.25;

/**
 * pdf.js textContent.items → 단순 item 배열로 변환
 * @returns {{page:number,x:number,y:number,w:number,h:number,str:string}[]}
 */
export function toSimpleItems(items, pageNumber) {
  return items
    .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
    .map((it) => ({
      page: pageNumber,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      h: Math.abs(it.height || it.transform[3]) || 10,
      str: it.str
    }));
}

/**
 * 좌표로 줄을 다시 만든다.
 * 1) 위→아래(y 내림차순) 정렬  2) y 차이가 허용 오차 이내면 같은 줄
 * 3) 줄 안에서 x 오름차순 정렬, 간격이 크면 공백 삽입
 * @returns {{page:number,lineNo:number,y:number,text:string,items:object[]}[]}
 */
export function rebuildLines(simpleItems) {
  const byPage = new Map();
  for (const it of simpleItems) {
    if (!byPage.has(it.page)) byPage.set(it.page, []);
    byPage.get(it.page).push(it);
  }
  const lines = [];
  for (const [page, items] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const groups = [];
    for (const it of items) {
      const last = groups[groups.length - 1];
      const tol = Math.max(2, it.h * LINE_TOLERANCE_RATIO);
      if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    }
    let lineNo = 1;
    for (const g of groups) {
      g.items.sort((a, b) => a.x - b.x);
      let text = '';
      let prevEnd = null;
      for (const it of g.items) {
        if (prevEnd !== null && it.x - prevEnd > it.h * SPACE_GAP_RATIO && !text.endsWith(' ')) text += ' ';
        text += it.str;
        prevEnd = it.x + it.w;
      }
      lines.push({ page, lineNo: lineNo++, y: Math.round(g.y), text: text.trim(), items: g.items });
    }
  }
  return lines;
}

/**
 * PDF 바이트 → 재구성된 줄 배열
 * @param {object} pdfjsLib pdf.js 모듈
 * @param {ArrayBuffer|Uint8Array} data
 * @param {object} [docOptions] getDocument 추가 옵션
 */
export async function extractLines(pdfjsLib, data, docOptions = {}) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await pdfjsLib.getDocument({ data: bytes, ...docOptions }).promise;
  const all = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    all.push(...toSimpleItems(content.items, p));
  }
  const lines = rebuildLines(all);
  await doc.destroy();
  return { numPages: doc.numPages, lines, hasText: lines.length > 0 };
}
