// Case runner skeleton — Day 2 step 1.
// The policy engine (Day 2 step 2) is NOT wired yet, so every case reports
// PENDING. This skeleton only proves the fixed-12 data loads and the
// scoring contract (verdict AND primary rule must match) prints correctly.
// It performs no API calls and no external actions.
import { CASES } from './cases.mjs';

// Placeholder evaluator, replaced by the policy engine in step 2.
function evaluate(_caseItem) {
  return { actual: 'PENDING', primaryRule: null };
}

const rows = CASES.map((c) => {
  const result = evaluate(c);
  const correct = result.actual === c.expected && result.primaryRule === c.primaryRule;
  return { ...c, actual: result.actual, actualRule: result.primaryRule, correct };
});

for (const r of rows) {
  console.log(`${r.id} expected=${r.expected}/${r.primaryRule} actual=${r.actual}/${r.actualRule ?? '-'} correct=${r.correct}`);
}

const passCorrect = rows.filter((r) => r.expected === 'PASS' && r.correct).length;
const blockCorrect = rows.filter((r) => r.expected === 'BLOCK' && r.correct).length;
const correct = rows.filter((r) => r.correct).length;
console.log(`summary: ${correct}/12 (PASS ${passCorrect}/6, BLOCK ${blockCorrect}/6, PENDING ${rows.length - correct})`);
console.log('hard-gate: NOT_EVALUATED (engine pending, Day 2 step 2)');
