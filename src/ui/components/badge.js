import { h } from '../dom.js';

const LABELS = { STOP: 'STOP', CHECK: 'CHECK', NO_ISSUES: 'No issues found', UNABLE: 'Unable to verify' };
export const statusBadge = (status) => h(`span.badge.badge-${status.toLowerCase()}`, {}, LABELS[status] ?? status);
