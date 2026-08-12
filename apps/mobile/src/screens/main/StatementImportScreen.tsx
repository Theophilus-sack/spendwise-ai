import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { callEdgeFunction } from '@/lib/supabase';
import { applyLocalOverrides } from '@/lib/nlpParse';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import { generateUUID } from '@spendwise/shared';
import type { DraftExpense, ExpenseCategory } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

interface ParsedTransaction {
  date: string;
  description: string;
  merchant_name?: string | null;
  amount: number;
  direction: 'debit' | 'credit';
  suggested_category?: ExpenseCategory;
}

export function StatementImportScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const { user } = useAuthStore();
  const { expenses } = useExpenseStore();

  const [fileName, setFileName] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0] || !user) return;

    const asset = result.assets[0];
    setFileName(asset.name);
    setLoading(true);
    try {
      const base64 = await new File(asset.uri).base64();
      const isPdf = asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf');

      const { transactions } = await callEdgeFunction<{ transactions: ParsedTransaction[] }>(
        'import-statement',
        isPdf
          ? { pdfBase64: base64 }
          // The picked file's real type (e.g. a PNG screenshot of a MoMo
          // statement) has to be passed through — sending an image encoded
          // as PNG but labeled as JPEG makes Claude's vision decoder fail to
          // read it, which looked like "no transactions found" but was
          // really "couldn't even see the image."
          : { imageBase64: base64, imageMimeType: asset.mimeType || 'image/jpeg' },
      );

      if (!transactions || transactions.length === 0) {
        Alert.alert("Couldn't read that statement", 'No transactions were found. Try a clearer scan or a different file.');
        return;
      }

      // Credits aren't expenses — the edge function already excludes pure
      // self-transfers (topping up MoMo from your own bank account etc.), so
      // what's left is genuine income. isIncome routes it to the income
      // store instead of expenses when BatchReview confirms it.
      const drafts: DraftExpense[] = applyLocalOverrides(
        transactions.map((t) => ({
          id:            generateUUID(),
          source:        'statement' as const,
          selected:      true,
          isIncome:      t.direction === 'credit',
          amount:        t.amount,
          category:      t.suggested_category ?? 'other',
          merchantName:  t.merchant_name ?? undefined,
          description:   t.description,
          paymentMethod: 'mobile_money' as const,
          date:          t.date,
        })),
        expenses,
      );

      nav.navigate('BatchReview', { drafts });
    } catch (err: any) {
      Alert.alert('Could not process statement', err.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setFileName(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Ionicons name="document-text-outline" size={48} color={Colors.primary} />
        <Text style={styles.title}>Import a statement</Text>
        <Text style={styles.hint}>
          Upload a PDF or photo of your bank or mobile money statement — we'll pull out the transactions for you to review before adding.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>{fileName ? `Reading ${fileName}…` : 'Reading statement…'}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.pickBtn} onPress={pickFile}>
            <Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} />
            <Text style={styles.pickBtnText}>Choose PDF or photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },

  title: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.text, marginTop: Spacing.sm },
  hint:  { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.md },

  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg,
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: Radius.lg,
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.xl,
  },
  pickBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.primary },

  loadingBox:  { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
  loadingText: { fontSize: Typography.sm, color: Colors.textSecondary },
});
