import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import { getArticleById, LITERACY_ARTICLES, LITERACY_CATEGORIES } from '@spendwise/shared';
import type { AppStackNavProp, AppStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';

export function LiteracyArticleScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const route = useRoute<RouteProp<AppStackParamList, 'LiteracyArticle'>>();
  const article = getArticleById(route.params.articleId);

  const related = useMemo(() => {
    if (!article) return [];
    return LITERACY_ARTICLES.filter(a => a.category === article.category && a.id !== article.id).slice(0, 3);
  }, [article]);

  if (!article) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Article not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>{article.emoji}</Text>
        <Text style={styles.category}>{LITERACY_CATEGORIES[article.category].label}</Text>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.meta}>{article.readMinutes} min read</Text>

        <View style={styles.divider} />

        {article.body.map((paragraph, i) => (
          <Text key={i} style={styles.paragraph}>{paragraph}</Text>
        ))}

        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>More on {LITERACY_CATEGORIES[article.category].label}</Text>
            {related.map(a => (
              <TouchableOpacity
                key={a.id}
                style={styles.relatedRow}
                onPress={() => nav.push('LiteracyArticle', { articleId: a.id })}
                activeOpacity={0.8}
              >
                <Text style={styles.relatedEmoji}>{a.emoji}</Text>
                <Text style={styles.relatedRowTitle} numberOfLines={2}>{a.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  backBtn: { padding: Spacing.xs },

  content: { padding: Spacing.lg, paddingBottom: 80 },
  emoji: { fontSize: 40, marginBottom: Spacing.sm },
  category: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.semibold, marginBottom: 4 },
  title: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text, lineHeight: Typography.xxl * 1.2 },
  meta: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: Spacing.sm },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  paragraph: { fontSize: Typography.base, color: Colors.text, lineHeight: Typography.base * 1.6, marginBottom: Spacing.md },

  relatedSection: { marginTop: Spacing.lg, gap: Spacing.sm },
  relatedTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.text, marginBottom: Spacing.xs },
  relatedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, ...Shadows.sm },
  relatedEmoji: { fontSize: 20 },
  relatedRowTitle: { flex: 1, fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: Typography.base, color: Colors.textSecondary },
});
