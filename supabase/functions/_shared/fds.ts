export const FDS_WEIGHTS = { budgetAdherence: 0.35, savingsRate: 0.30, consistency: 0.20, improvement: 0.15 };
const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);

// A flat bonus for completing that week's reflection — kept as a small,
// transparent addition on top of the core weighted score rather than folded
// into the 35/30/20/15 weighting itself. Reweighting the core formula to add
// a "regular reviews" factor is a real product decision (it changes what
// every existing score means) and deserves its own explicit design pass, not
// a silent change bundled into a feature request. This bonus is the honest
// middle ground: reflecting measurably moves the number today, without
// touching the four components' established meaning.
const REFLECTION_BONUS = 2;

export interface FDSComputation {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
  components: {
    budgetAdherence: number;
    savingsRate: number;
    consistency: number;
    improvement: number;
  };
  uniqueDays: number;
  delta: number;
  reflectionBonus: number;
}

/**
 * Computes one user's weekly Financial Discipline Score. Shared between the
 * on-demand `compute-fds` endpoint and the scheduled `weekly-digest` job so
 * the formula only ever lives in one place — the two previously reimplemented
 * this independently and drifted (a real bug: the savings-rate component was
 * silently zeroed in one copy but not the other).
 */
export async function computeFDS(supabase: any, userId: string, weekStart: string): Promise<FDSComputation> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const [{ data: expenses }, { data: budgets }, { data: profile }, { data: prevScore }, { data: reflection }] =
    await Promise.all([
      supabase.from('expenses').select('amount,category,date').eq('user_id', userId).gte('date', weekStart).lt('date', weekEndStr),
      supabase.from('budgets').select('category,limit_amount').eq('user_id', userId),
      supabase.from('profiles').select('monthly_income,savings_target_pct').eq('user_id', userId).single(),
      supabase.from('discipline_scores').select('score').eq('user_id', userId).lt('week_start', weekStart).order('week_start', { ascending: false }).limit(1).single(),
      supabase.from('weekly_reflections').select('id').eq('user_id', userId).eq('week_start', weekStart).maybeSingle(),
    ]);

  const expList = expenses ?? [];
  const budgetList = budgets ?? [];

  // Component 1: Budget Adherence
  const spendByCategory = expList.reduce((acc: any, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount);
    return acc;
  }, {});
  const categoriesOver = budgetList.filter((b: any) => (spendByCategory[b.category] ?? 0) > parseFloat(b.limit_amount) * (7 / 30));
  const budgetAdherence = clamp(budgetList.length > 0 ? 1 - (categoriesOver.length / budgetList.length) : 1);

  // Component 2: Savings Rate
  const weeklyIncome     = parseFloat(profile?.monthly_income ?? 0) / 4.33;
  const targetSavingsPct = parseFloat(profile?.savings_target_pct ?? 20) / 100;
  const targetSavings    = weeklyIncome * targetSavingsPct;
  const actualSpent      = expList.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
  const actualSavings    = Math.max(0, weeklyIncome - actualSpent);
  const savingsRate      = clamp(targetSavings > 0 ? actualSavings / targetSavings : actualSavings > 0 ? 0.5 : 0);

  // Component 3: Consistency
  const uniqueDays = new Set(expList.map((e: any) => e.date)).size;
  const consistency = clamp(uniqueDays / 7);

  // Component 4: Improvement trend (sigmoid — always bounded in (0,1))
  const rawScore = (budgetAdherence * FDS_WEIGHTS.budgetAdherence + savingsRate * FDS_WEIGHTS.savingsRate + consistency * FDS_WEIGHTS.consistency + 0.5 * FDS_WEIGHTS.improvement) * 100;
  const delta = prevScore?.score != null ? rawScore - parseFloat(prevScore.score) : 0;
  const improvement = 1 / (1 + Math.exp(-delta / 10));

  const weighted = (budgetAdherence * FDS_WEIGHTS.budgetAdherence + savingsRate * FDS_WEIGHTS.savingsRate + consistency * FDS_WEIGHTS.consistency + improvement * FDS_WEIGHTS.improvement) * 100;
  const smoothed = prevScore?.score != null ? 0.7 * weighted + 0.3 * parseFloat(prevScore.score) : weighted;
  const reflectionBonus = reflection ? REFLECTION_BONUS : 0;
  const score = clamp(Math.round((smoothed + reflectionBonus) * 10) / 10, 0, 100);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  const trend = delta > 2 ? 'improving' : delta < -2 ? 'declining' : 'stable';

  return {
    score, grade, trend,
    components: { budgetAdherence, savingsRate, consistency, improvement },
    uniqueDays, delta, reflectionBonus,
  };
}

/**
 * `commentary` is optional and, when omitted, is left out of the upsert
 * payload entirely — not set to null — so a caller that's only re-saving the
 * score (e.g. after a reflection bonus changes it) can't accidentally wipe
 * out a commentary a previous call already generated for that week.
 */
export async function saveFDS(
  supabase: any, userId: string, weekStart: string, computation: FDSComputation, commentary?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    user_id:           userId,
    week_start:        weekStart,
    score:              computation.score,
    budget_adherence:   computation.components.budgetAdherence,
    savings_rate:       computation.components.savingsRate,
    consistency:        computation.components.consistency,
    improvement_trend:  computation.components.improvement,
  };
  if (commentary !== undefined) payload.ai_commentary = commentary;
  await supabase.from('discipline_scores').upsert(payload);
}
