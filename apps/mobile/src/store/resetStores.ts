import { useExpenseStore } from './expenseStore';
import { useBudgetStore } from './budgetStore';
import { useGoalStore } from './goalStore';
import { useIncomeStore } from './incomeStore';
import { useDebtStore } from './debtStore';
import { useDisciplineStore } from './disciplineStore';
import { useNotificationStore } from './notificationStore';
import { useWeeklyReflectionStore } from './weeklyReflectionStore';

/**
 * Clears every per-user data store's in-memory state. These stores are
 * module-level singletons, so nothing about a screen unmounting guarantees
 * a previous account's data is gone — this must run explicitly on sign-out,
 * and defensively whenever the active session's user id changes, so a new
 * session can never render with the last account's financial data still
 * sitting in memory while a fresh load is in flight (or has silently failed).
 */
export function resetAllUserStores(): void {
  useExpenseStore.getState().reset();
  useBudgetStore.getState().reset();
  useGoalStore.getState().reset();
  useIncomeStore.getState().reset();
  useDebtStore.getState().reset();
  useDisciplineStore.getState().reset();
  useNotificationStore.getState().reset();
  useWeeklyReflectionStore.getState().reset();
}
