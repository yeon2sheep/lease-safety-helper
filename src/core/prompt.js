// [1차 더미] AI 상담 프롬프트 생성. 2차: 목적별 추천 질문/범례 정교화.
import { PURPOSES } from './mask.js';

const QUESTIONS = {
  explain_terms: 'Please explain the structure of these documents and the meaning of each legal term in simple English.',
  fraud_risk: 'Check whether the owner matches across these documents and whether the mortgage is excessive compared to the deposit.',
  contract_conditions: 'Please explain the deposit, rent, contract period and special terms, and point out anything unfavorable to the tenant.'
};

export function buildPrompt({ purpose, maskedText, persons, checklist }) {
  const parts = [`Purpose: ${PURPOSES[purpose]?.label ?? '(not selected)'}`];
  if (purpose === 'fraud_risk') {
    const legend = (persons?.groups ?? []).map((g) => `${g.pseudonym} = ${g.role}`).join('\n');
    parts.push('Role legend:\n' + (legend || '(none)'));
    const results = (checklist ?? [])
      .filter((c) => c.status === 'STOP' || c.status === 'CHECK')
      .map((c) => `- [${c.status}] ${c.title}`)
      .join('\n');
    parts.push('Check results (from the original documents):\n' + (results || '(none)'));
  }
  parts.push('Question:\n' + QUESTIONS[purpose]);
  parts.push('Masked documents:\n' + maskedText);
  parts.push('Please answer in English.');
  return parts.join('\n\n');
}
