import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { Card, Button } from '@/components/ui';
import { DateRangePickerModal } from '@/components/DateRangePickerModal';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { formatCurrency, formatDateShort } from '@spendwise/shared';
import { exportExpensesCSV, exportExpensesPDF } from '@/lib/export';

type RangePreset = 'this_month' | 'last_month' | 'this_year' | 'all_time' | 'custom';
type Format = 'csv' | 'pdf';

const RANGE_OPTIONS: Array<{ id: RangePreset; label: string }> = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year',  label: 'This Year' },
  { id: 'all_time',   label: 'All Time' },
];

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

// `custom` is handled separately by the caller, since it needs the picked
// range rather than anything computable from just today's date.
function getRangeBounds(preset: Exclude<RangePreset, 'custom'>): { start: string | null; end: string | null; label: string } {
  const now = new Date();
  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: iso(start), end: null, label: `This Month (${now.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })})` };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: iso(start), end: iso(end), label: `Last Month (${start.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })})` };
  }
  if (preset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start: iso(start), end: null, label: `${now.getFullYear()}` };
  }
  return { start: null, end: null, label: 'All Time' };
}

export function ExportScreen() {
  const user    = useAuthStore(s => s.user);
  const profile = useAuthStore(s => s.profile);
  const currency = profile?.currency ?? 'GHS';

  const expenses     = useExpenseStore(s => s.expenses);
  const loadExpenses = useExpenseStore(s => s.load);

  const [range,      setRange]      = useState<RangePreset>('this_month');
  const [format,     setFormat]     = useState<Format>('csv');
  const [exporting,  setExporting]  = useState(false);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => { if (user) loadExpenses(user.id); }, [user?.id]);

  const { start, end, label } = useMemo(() => {
    if (range === 'custom' && customRange) {
      const sameDay = customRange.start === customRange.end;
      return {
        start: customRange.start,
        end:   customRange.end,
        label: sameDay ? formatDateShort(customRange.start) : `${formatDateShort(customRange.start)} – ${formatDateShort(customRange.end)}`,
      };
    }
    return getRangeBounds(range === 'custom' ? 'this_month' : range);
  }, [range, customRange]);

  const filtered = useMemo(() => {
    return expenses
      .filter(e => (!start || e.date >= start) && (!end || e.date <= end))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, start, end]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const handleExport = async () => {
    if (filtered.length === 0) {
      Alert.alert('Nothing to export', 'There are no expenses in this date range.');
      return;
    }
    setExporting(true);
    try {
      if (format === 'csv') {
        await exportExpensesCSV(filtered, label);
      } else {
        await exportExpensesPDF(filtered, currency, label);
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.fieldLabel}>Date range</Text>
          <View style={styles.chipGrid}>
            {RANGE_OPTIONS.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, range === r.id && styles.chipActive]}
                onPress={() => setRange(r.id)}
              >
                <Text style={[styles.chipText, range === r.id && styles.chipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, styles.chipCustom, range === 'custom' && styles.chipActive]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={range === 'custom' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.chipText, range === 'custom' && styles.chipTextActive]}>
                {range === 'custom' && customRange ? label : 'Custom'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Format</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity
              style={[styles.formatBtn, format === 'csv' && styles.formatBtnActive]}
              onPress={() => setFormat('csv')}
            >
              <Ionicons name="grid-outline" size={18} color={format === 'csv' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.formatText, format === 'csv' && styles.formatTextActive]}>CSV</Text>
              <Text style={styles.formatSub}>Opens in Excel, Sheets, Numbers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatBtn, format === 'pdf' && styles.formatBtnActive]}
              onPress={() => setFormat('pdf')}
            >
              <Ionicons name="document-text-outline" size={18} color={format === 'pdf' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.formatText, format === 'pdf' && styles.formatTextActive]}>PDF</Text>
              <Text style={styles.formatSub}>A readable, shareable report</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{label}</Text>
          <Text style={styles.summaryValue}>{formatCurrency(total, currency)}</Text>
          <Text style={styles.summarySub}>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}</Text>
        </Card>

        <Button
          label={exporting ? 'Preparing…' : `Export ${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`}
          onPress={handleExport}
          loading={exporting}
          disabled={filtered.length === 0}
          fullWidth
          size="lg"
        />
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        initialStart={customRange?.start}
        initialEnd={customRange?.end}
        onApply={(rangeStart, rangeEnd) => {
          setCustomRange({ start: rangeStart, end: rangeEnd });
          setRange('custom');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.xxxl },

  card: { gap: Spacing.md },
  fieldLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:     { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipCustom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.primary, fontWeight: Typography.semibold },

  formatRow: { flexDirection: 'row', gap: Spacing.sm },
  formatBtn: { flex: 1, alignItems: 'center', gap: 4, padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt },
  formatBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  formatText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textSecondary },
  formatTextActive: { color: Colors.primary },
  formatSub:  { fontSize: Typography.xs, color: Colors.textTertiary, textAlign: 'center' },

  summaryCard:  { alignItems: 'center', gap: 2, paddingVertical: Spacing.lg },
  summaryLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  summaryValue: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  summarySub:   { fontSize: Typography.xs, color: Colors.textTertiary },
});
