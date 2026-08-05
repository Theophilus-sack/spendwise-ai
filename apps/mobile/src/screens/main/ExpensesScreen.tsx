import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useExpenseStore } from "@/store/expenseStore";
import { useAuthStore } from "@/store/authStore";
import { Colors, Typography, Spacing, Radius, Shadows } from "@/theme";
import {
  formatCurrency,
  formatDateShort,
  getCategoryEmoji,
  getCategoryLabel,
  getCustomCategories,
  sortCategoriesByUsage,
  CATEGORIES,
  CATEGORY_LIST,
} from "@spendwise/shared";
import type { Expense, ExpenseCategory } from "@spendwise/shared";
import type { AppStackNavProp } from "@/navigation/types";

export function ExpensesScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const insets = useSafeAreaInsets();
  const { expenses, deleteExpense } = useExpenseStore();
  const { profile } = useAuthStore();
  const currency = profile?.currency ?? "GHS";

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<ExpenseCategory | "all">("all");

  // Filter chips reflect each user's own spending: custom categories
  // actually used on a real expense (e.g. "Trustwash") are included instead
  // of only ever offering the fixed built-in list, and the whole set is
  // ordered by how often each category actually appears — most-used right
  // after "All" — rather than one fixed order for everyone.
  const categoryFilterIds = useMemo(() => {
    const used = expenses.map((e) => e.category);
    const customCategories = getCustomCategories(used);
    return sortCategoriesByUsage([...CATEGORY_LIST, ...customCategories], used);
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return expenses.filter((e) => {
      const matchSearch =
        !q ||
        e.merchantName?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        getCategoryLabel(e.category).toLowerCase().includes(q);
      const matchCat = filterCat === "all" || e.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [expenses, search, filterCat]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const confirmDelete = (e: Expense) => {
    Alert.alert(
      "Delete Expense",
      `Delete ${e.merchantName ?? e.description ?? getCategoryLabel(e.category)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteExpense(e.id).catch((err) => {
              Alert.alert(
                "Sync failed",
                err instanceof Error
                  ? err.message
                  : "Could not fully delete this expense. Please try again.",
              );
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {/* ── Header — bleeds behind the status bar so it blends with it ── */}
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary]}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerBrand}>
            <View style={styles.headerIconBg}>
              <Ionicons name="receipt" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.headerTitle}>SpendWise AI</Text>
          </View>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => nav.navigate("Export")}
            hitSlop={8}
          >
            <Ionicons name="download-outline" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.pageTitle}>My Expenses</Text>
        <Text style={styles.pageSubtitle}>See where your money is going.</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color={Colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by merchant or category..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textTertiary}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        style={styles.filterList}
        data={[
          { id: "all", label: "All", emoji: "📋" },
          ...categoryFilterIds.map((id) => ({
            id,
            label: CATEGORIES[id as keyof typeof CATEGORIES]?.label ?? id,
            emoji: CATEGORIES[id as keyof typeof CATEGORIES]?.emoji ?? "✨",
          })),
        ]}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterCat === item.id && styles.filterChipActive,
            ]}
            onPress={() => setFilterCat(item.id as any)}
          >
            <Text style={styles.filterEmoji}>{item.emoji}</Text>
            <Text
              style={[
                styles.filterText,
                filterCat === item.id && styles.filterTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{filtered.length} transactions</Text>
        <Text style={styles.totalAmount}>
          {formatCurrency(total, currency)}
        </Text>
      </View>

      {/* Expense list */}
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        style={styles.expenseList}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: e }) => (
          <TouchableOpacity
            style={styles.expenseRow}
            onPress={() => nav.navigate("AddExpense", { expenseId: e.id })}
            onLongPress={() => confirmDelete(e)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.expIcon,
                {
                  backgroundColor:
                    (Colors.categories[
                      e.category as keyof typeof Colors.categories
                    ] ?? Colors.textTertiary) + "22",
                },
              ]}
            >
              <Text style={styles.expEmoji}>
                {getCategoryEmoji(e.category)}
              </Text>
            </View>
            <View style={styles.expInfo}>
              <Text style={styles.expName} numberOfLines={1}>
                {e.merchantName ??
                  e.description ??
                  getCategoryLabel(e.category)}
              </Text>
              <View style={styles.expMeta}>
                <Text style={styles.expDate}>{formatDateShort(e.date)}</Text>
                {e.aiCategorized && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.expRight}>
              <Text style={styles.expAmount}>
                -{formatCurrency(e.amount, currency)}
              </Text>
              <TouchableOpacity
                onPress={() => confirmDelete(e)}
                hitSlop={8}
                style={styles.expMenuBtn}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No expenses found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    ...Shadows.primary,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  headerIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: "#fff",
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  body: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.xs,
  },
  pageTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.text,
  },
  pageSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.normal,
    marginBottom: Spacing.sm,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: Typography.base, color: Colors.text },

  // flexShrink:0/flexGrow:0 — belt-and-suspenders alongside expenseList's
  // flex:1 above: this row must never be a candidate for flexbox's
  // shrink-to-fit distribution, regardless of what else is competing for
  // vertical space (a tall expense list, the keyboard opening, etc).
  filterList: { flexShrink: 0, flexGrow: 0 },
  filterRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  filterEmoji: { fontSize: 13 },
  filterText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  filterTextActive: { color: "#fff", fontWeight: Typography.semibold },

  totalRow: {
    flexShrink: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  totalLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  totalAmount: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.text,
  },
  // flex:1 (not just contentContainerStyle) makes this the one bounded,
  // internally-scrolling region — without it, the list requests unbounded
  // height as more expenses are added, and once total content exceeds the
  // screen height, flexbox's default flexShrink:1 proportionally shrinks
  // every sibling that doesn't opt out, including the category filter row
  // above it, down toward nothing.
  expenseList: { flex: 1 },
  list: { padding: Spacing.base, gap: Spacing.sm },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  expIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  expEmoji: { fontSize: 22 },
  expInfo: { flex: 1 },
  expName: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.text,
  },
  expMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  expDate: { fontSize: Typography.xs, color: Colors.textSecondary },
  aiBadge: {
    backgroundColor: Colors.primary + "15",
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 9,
    color: Colors.primary,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
  },
  expRight: { alignItems: "flex-end", gap: 4 },
  expAmount: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.text,
  },
  expMenuBtn: { padding: 2 },
  empty: { alignItems: "center", paddingTop: 80, gap: Spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: Typography.base, color: Colors.textSecondary },
});
