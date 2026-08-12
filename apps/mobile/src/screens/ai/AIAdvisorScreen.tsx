import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import type { ChatMessage, AIAdvisorResponse } from '@spendwise/shared';
import type { AIAdvisorProps } from '@/navigation/types';

const QUICK_PROMPTS = [
  'Why did I overspend last month?',
  'Am I on track with my budget?',
  'How can I save more this month?',
  'What\'s my biggest spending problem?',
];

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm your AI financial advisor. I have access to your complete spending history, budgets, and goals. Ask me anything about your finances — I'll give you specific, personalised advice based on your actual data. 💸",
  timestamp: new Date().toISOString(),
};

export function AIAdvisorScreen() {
  const route  = useRoute<AIAdvisorProps['route']>();
  const { user } = useAuthStore();

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      // Resume the most recent conversation instead of always starting
      // fresh — previously every screen visit began blank, so the AI (and
      // the user) lost all prior context the moment they left the screen.
      let resumedId: string | undefined;
      if (user) {
        const { data } = await supabase
          .from('ai_conversations')
          .select('id, messages')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages as ChatMessage[]);
          setConversationId(data.id);
          resumedId = data.id;
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
      } else {
        setMessages([WELCOME_MESSAGE]);
      }

      // Auto-trigger initial message if provided (e.g. "Ask AI Coach" deep
      // links from Weekly Reflection / What-If Simulator) — pass the just-
      // resolved conversation id explicitly rather than relying on the
      // `conversationId` state var, which wouldn't have re-rendered yet in
      // this same effect and would otherwise start a stray new conversation.
      if (route.params?.initialMessage) {
        setTimeout(() => sendMessage(route.params!.initialMessage!, resumedId), 300);
      }
    })();
  }, []);

  const sendMessage = async (text?: string, conversationIdOverride?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await callEdgeFunction<AIAdvisorResponse>('ai-advisor', {
        message: messageText,
        conversationId: conversationIdOverride ?? conversationId,
        userId: user?.id,
      });

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        actions: response.actions,
      };

      setMessages(prev => [...prev, assistantMsg]);
      setConversationId(response.conversationId);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please check your internet connection and try again.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🤖</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
          {item.actions && item.actions.length > 0 && (
            <View style={styles.actions}>
              {item.actions.map((action, i) => (
                <TouchableOpacity key={i} style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ErrorBoundary label="the chat">
          <FlatList
            // Inverted, newest-first data instead of an imperative scrollToEnd()
            // call — that native scroll command was crashing on some builds
            // (Expo Go / New Architecture command-registry issue). This is the
            // standard chat-list pattern: the newest message is always at data
            // index 0, which an inverted list renders at the visual bottom, so
            // "stay scrolled to the latest message" falls out for free with no
            // native command involved at all.
            data={[...messages].reverse()}
            inverted
            renderItem={renderMessage}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.list}
            // inverted flips Header/Footer positions too — Header renders at
            // the visual bottom, which is where the typing indicator belongs.
            ListHeaderComponent={loading ? (
              <View style={styles.typingIndicator}>
                <View style={styles.avatar}><Text style={styles.avatarEmoji}>🤖</Text></View>
                <View style={styles.bubbleAssistant}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              </View>
            ) : null}
          />
        </ErrorBoundary>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <View style={styles.quickPrompts}>
            <Text style={styles.quickPromptsLabel}>Try asking:</Text>
            <View style={styles.quickPromptsRow}>
              {QUICK_PROMPTS.map(prompt => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.quickPromptChip}
                  onPress={() => sendMessage(prompt)}
                >
                  <Text style={styles.quickPromptText} numberOfLines={2}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me anything about your finances..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },
  flex:    { flex: 1 },
  list:    { padding: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.base },

  messageRow:     { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.sm },
  messageRowUser: { flexDirection: 'row-reverse' },

  avatar:      { width: 32, height: 32, borderRadius: Radius.full, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 16 },

  bubble:           { maxWidth: '80%', borderRadius: Radius.lg, padding: Spacing.md, ...Shadows.sm },
  bubbleAssistant:  { backgroundColor: Colors.surface, borderBottomLeftRadius: 4 },
  bubbleUser:       { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleText:       { fontSize: Typography.base, color: Colors.text, lineHeight: 22 },
  bubbleTextUser:   { color: Colors.textInverse },

  actions:       { marginTop: Spacing.sm, gap: Spacing.xs },
  actionBtn:     { backgroundColor: Colors.primary + '18', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primary + '30' },
  actionBtnText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.semibold },

  typingIndicator: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.sm, padding: Spacing.xs },

  quickPrompts:     { backgroundColor: Colors.surface, padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  quickPromptsLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickPromptsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickPromptChip:  { backgroundColor: Colors.primary + '10', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + '25', maxWidth: '47%' },
  quickPromptText:  { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },

  inputBar:        { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.base, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput:       { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, fontSize: Typography.base, color: Colors.text, maxHeight: 100, borderWidth: 1.5, borderColor: Colors.border },
  sendBtn:         { width: 42, height: 42, borderRadius: Radius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.primary },
  sendBtnDisabled: { backgroundColor: Colors.border },
});
