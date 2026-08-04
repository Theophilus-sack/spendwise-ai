import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/authStore';
import { useDisciplineStore } from '@/store/disciplineStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import {
  LITERACY_ARTICLES, LITERACY_CATEGORIES, recommendArticles,
} from '@spendwise/shared';
import type { LiteracyArticle, LiteracyCategory, FDSComponents } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

export function LiteracyHubScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const { components, load: loadScore } = useDisciplineStore();

  const [filterCat, setFilterCat] = useState<LiteracyCategory | 'all'>('all');

  useEffect(() => {
    if (user) loadScore(user.id);
  }, [user?.id]);

  const weakestComponent = useMemo<keyof FDSComponents | undefined>(() => {
    if (!components) return undefined;
    const entries = Object.entries(components) as Array<[keyof FDSComponents, number]>;
    return entries.sort((a, b) => a[1] - b[1])[0]?.[0];
  }, [components]);

  const recommended = useMemo(
    () => recommendArticles(profile?.spendingPersonality, weakestComponent, 3),
    [profile?.spendingPersonality, weakestComponent],
  );

  const filtered = useMemo(
    () => filterCat === 'all' ? LITERACY_ARTICLES : LITERACY_ARTICLES.filter(a => a.category === filterCat),
    [filterCat],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {/* ── Header — bleeds behind the status bar so it blends with it ── */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerBrand}>
            <View style={styles.headerIconBg}>
              <Ionicons name="school" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.headerTitle}>SpendWise AI</Text>
          </View>
          <TouchableOpacity style={styles.headerActionBtn} onPress={() => nav.navigate('ScoreDetail')} hitSlop={8}>
            <Ionicons name="shield-checkmark-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={filtered}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <ArticleCard article={item} onPress={() => nav.navigate('LiteracyArticle', { articleId: item.id })} />}
        ListHeaderComponent={
          <>
            <View style={styles.body}>
              <Text style={styles.pageTitle}>Financial Literacy</Text>
              <Text style={styles.pageSubtitle}>Short, practical reads — no jargon.</Text>
            </View>

            {recommended.length > 0 && filterCat === 'all' && (
              <View style={styles.recommendedSection}>
                <Text style={styles.sectionTitle}>For you</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRow}>
                  {recommended.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={styles.recommendedCard}
                      onPress={() => nav.navigate('LiteracyArticle', { articleId: a.id })}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.recommendedEmoji}>{a.emoji}</Text>
                      <Text style={styles.recommendedTitle} numberOfLines={2}>{a.title}</Text>
                      <Text style={styles.recommendedMeta}>{a.readMinutes} min read</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <FlatList
              horizontal
              data={[{ id: 'all' as const, label: 'All', emoji: '📚' }, ...Object.entries(LITERACY_CATEGORIES).map(([id, c]) => ({ id: id as LiteracyCategory, label: c.label, emoji: c.emoji }))]}
              keyExtractor={i => i.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.filterChip, filterCat === item.id && styles.filterChipActive]}
                  onPress={() => setFilterCat(item.id)}
                >
                  <Text style={styles.filterEmoji}>{item.emoji}</Text>
                  <Text style={[styles.filterText, filterCat === item.id && styles.filterTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </>
        }
      />
    </SafeAreaView>
  );
}

function ArticleCard({ article, onPress }: { article: LiteracyArticle; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardIconBg}>
        <Text style={styles.cardEmoji}>{article.emoji}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.cardSummary} numberOfLines={2}>{article.summary}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardCategory}>{LITERACY_CATEGORIES[article.category].label}</Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardReadTime}>{article.readMinutes} min read</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl,
    ...Shadows.primary,
  },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIconBg:{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: '#fff' },
  headerActionBtn: { width: 38, height: 38, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.xs },
  pageTitle:    { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  pageSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary },

  sectionTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  recommendedSection: { paddingTop: Spacing.lg },
  recommendedRow: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  recommendedCard: { width: 150, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: 6, ...Shadows.sm },
  recommendedEmoji: { fontSize: 24 },
  recommendedTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.text, minHeight: 34 },
  recommendedMeta: { fontSize: Typography.xs, color: Colors.textTertiary },

  filterRow:  { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  filterEmoji:{ fontSize: 13 },
  filterText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  filterTextActive: { color: '#fff', fontWeight: Typography.semibold },

  list: { paddingBottom: 80, gap: Spacing.sm },
  card: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.base, marginBottom: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadows.sm },
  cardIconBg: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text },
  cardSummary: { fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: Typography.xs * 1.4 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardCategory: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },
  cardDot: { fontSize: Typography.xs, color: Colors.textTertiary },
  cardReadTime: { fontSize: Typography.xs, color: Colors.textTertiary },
});
