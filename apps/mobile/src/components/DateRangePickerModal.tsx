import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { formatDate, toISODate } from '@spendwise/shared';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with ISO dates (YYYY-MM-DD), inclusive on both ends. */
  onApply: (start: string, end: string) => void;
  initialStart?: string;
  initialEnd?: string;
}

/**
 * A single-date-or-range picker modeled on the MTN MoMo statement screen's
 * calendar (two date chips, a month grid, Clear/Apply) — reused by Analytics
 * (viewing spending for a custom period) and Export (choosing what to export).
 */
export function DateRangePickerModal({ visible, onClose, onApply, initialStart, initialEnd }: Props) {
  const [start, setStart] = useState<string | undefined>(initialStart);
  const [end,   setEnd]   = useState<string | undefined>(initialEnd);

  // Re-seed from props each time the modal opens, so reopening it starts
  // from whatever range is currently active rather than the last edit.
  useEffect(() => {
    if (visible) {
      setStart(initialStart);
      setEnd(initialEnd);
    }
  }, [visible, initialStart, initialEnd]);

  const onDayPress = (day: DateData) => {
    const picked = day.dateString;
    // No range yet, or a full range already picked — start a fresh one.
    if (!start || (start && end)) {
      setStart(picked);
      setEnd(undefined);
      return;
    }
    // One end already picked — this completes the range, in either order.
    if (picked < start) {
      setEnd(start);
      setStart(picked);
    } else {
      setEnd(picked);
    }
  };

  const markedDates = useMemo(() => {
    if (!start) return {};
    if (!end) {
      return { [start]: { startingDay: true, endingDay: true, color: Colors.primary, textColor: '#fff' } };
    }
    const marks: Record<string, any> = {};
    const cursor = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    while (cursor <= endDate) {
      const iso = toISODate(cursor);
      marks[iso] = {
        color: Colors.primary,
        textColor: '#fff',
        startingDay: iso === start,
        endingDay: iso === end,
      };
      cursor.setDate(cursor.getDate() + 1);
    }
    return marks;
  }, [start, end]);

  const handleClear = () => {
    setStart(undefined);
    setEnd(undefined);
  };

  const handleApply = () => {
    if (!start) return;
    onApply(start, end ?? start);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Select dates</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.chipsRow}>
              <View style={[styles.dateChip, start && styles.dateChipFilled]}>
                <Text style={[styles.dateChipText, start && styles.dateChipTextFilled]}>
                  {start ? formatDate(start) : 'Start date'}
                </Text>
              </View>
              <Text style={styles.dash}>–</Text>
              <View style={[styles.dateChip, end && styles.dateChipFilled]}>
                <Text style={[styles.dateChipText, end && styles.dateChipTextFilled]}>
                  {end ? formatDate(end) : 'End date'}
                </Text>
              </View>
            </View>

            <Calendar
              current={start}
              onDayPress={onDayPress}
              markingType="period"
              markedDates={markedDates}
              maxDate={toISODate(new Date())}
              theme={{
                backgroundColor: Colors.surface,
                calendarBackground: Colors.surface,
                textSectionTitleColor: Colors.textSecondary,
                dayTextColor: Colors.text,
                todayTextColor: Colors.primary,
                monthTextColor: Colors.text,
                textDisabledColor: Colors.textTertiary,
                arrowColor: Colors.primary,
              }}
              style={styles.calendar}
            />

            <View style={styles.actions}>
              <Button label="Clear" onPress={handleClear} variant="outline" style={{ flex: 1 }} />
              <Button label="Apply" onPress={handleApply} disabled={!start} style={{ flex: 1 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1 },
  overlayTouch: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:  { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text },

  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dateChip: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surfaceAlt },
  dateChipFilled: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  dateChipText: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center' },
  dateChipTextFilled: { color: Colors.primary, fontWeight: Typography.semibold },
  dash: { color: Colors.textTertiary },

  calendar: { borderRadius: Radius.lg },

  actions: { flexDirection: 'row', gap: Spacing.md },
});
