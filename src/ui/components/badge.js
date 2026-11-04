import { h } from '../dom.js';

const LABELS = { STOP: 'STOP', CHECK: 'CHECK', OK: 'OK', UNVERIFIED: 'Unverified' };
// 기존 CSS 클래스 이름을 그대로 쓰기 위한 연결 (디자인 변경 없음)
export const cssKey = (status) => ({ OK: 'no_issues', UNVERIFIED: 'unable' }[status] ?? status.toLowerCase());
export const statusBadge = (status) => h(`span.badge.badge-${cssKey(status)}`, {}, LABELS[status] ?? status);
