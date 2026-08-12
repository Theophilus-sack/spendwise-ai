import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore }    from '@/store/authStore';
import { useExpenseStore } from '@/store/expenseStore';
import { parseTextToDrafts } from '@/lib/nlpParse';
import { Button } from '@/components/ui';
import { Colors, Typography, Spacing, Radius } from '@/theme';
import type { AppStackNavProp } from '@/navigation/types';
import type * as SpeechRecognitionTypes from 'expo-speech-recognition';

// expo-speech-recognition is a native module that isn't present in Expo Go
// (only in a custom dev-client build) — a plain top-level `import` calls
// requireNativeModule() the moment this file loads, which happens at app
// startup (AppNavigator registers every screen upfront), crashing the whole
// app before the user ever opens this screen. `require()` inside a try/catch
// defers and contains that failure to just this file instead.
let SpeechModule: typeof SpeechRecognitionTypes | null = null;
try {
  SpeechModule = require('expo-speech-recognition');
} catch {
  SpeechModule = null;
}
const ExpoSpeechRecognitionModule = SpeechModule?.ExpoSpeechRecognitionModule ?? null;
// Hooks must be called unconditionally in the same order every render, so
// this picks a real-hook-or-no-op once at module scope rather than branching
// inside the component.
const useSpeechRecognitionEvent = SpeechModule?.useSpeechRecognitionEvent ?? (() => {});

export function VoiceExpenseScreen() {
  const nav = useNavigation<AppStackNavProp>();
  const { expenses } = useExpenseStore();
  const { user } = useAuthStore();

  const [isRecording, setIsRecording] = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [parsing,     setParsing]     = useState(false);

  useSpeechRecognitionEvent('result', (event: SpeechRecognitionTypes.ExpoSpeechRecognitionResultEvent) => {
    const best = event.results[0]?.transcript;
    if (best) setTranscript(best);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
  });

  useSpeechRecognitionEvent('error', (event: SpeechRecognitionTypes.ExpoSpeechRecognitionErrorEvent) => {
    setIsRecording(false);
    if (event.error === 'no-speech') return; // silently ignore — user just didn't say anything before stopping
    Alert.alert("Couldn't hear that", event.message || 'Please try again.');
  });

  const startRecording = async () => {
    if (!ExpoSpeechRecognitionModule) return;
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Microphone access needed',
        'Allow microphone and speech recognition access in Settings to record expenses by voice.',
      );
      return;
    }
    setTranscript('');
    setIsRecording(true);
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
    });
  };

  const stopRecording = () => {
    ExpoSpeechRecognitionModule?.stop();
  };

  const handleParse = async () => {
    if (!transcript.trim() || !user) return;
    setParsing(true);
    try {
      const drafts = await parseTextToDrafts(transcript, expenses, 'voice');
      if (drafts.length === 0) {
        Alert.alert("Couldn't parse that", 'Try including an amount for each expense, e.g. "coffee twenty cedis, lunch forty five".');
        return;
      }
      nav.navigate('BatchReview', { drafts });
    } finally {
      setParsing(false);
    }
  };

  if (!ExpoSpeechRecognitionModule) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        <View style={styles.body}>
          <Ionicons name="construct-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.hint}>Voice Add needs a development build</Text>
          <Text style={styles.hintSmall}>
            This feature uses on-device speech recognition, which Expo Go doesn't support. It'll work once you're running the app's custom development build.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.hint}>
          {isRecording ? 'Listening…' : 'Tap the mic and say your expense(s) 👇'}
        </Text>
        <Text style={styles.hintSmall}>e.g. "Coffee 20 cedis, lunch at Papaye 45, Bolt 15 cedis"</Text>

        <View style={styles.transcriptBox}>
          <Text style={transcript ? styles.transcriptText : styles.transcriptPlaceholder}>
            {transcript || 'Your words will appear here…'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="#fff" />
        </TouchableOpacity>

        <Button
          label="Parse ✨"
          onPress={handleParse}
          loading={parsing}
          disabled={!transcript.trim() || isRecording}
          fullWidth
          size="lg"
          style={styles.parseBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },

  hint:      { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.text, textAlign: 'center' },
  hintSmall: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },

  transcriptBox: {
    width: '100%', minHeight: 100, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, padding: Spacing.base, justifyContent: 'center',
  },
  transcriptText:        { fontSize: Typography.base, color: Colors.text },
  transcriptPlaceholder: { fontSize: Typography.base, color: Colors.textTertiary },

  micButton: {
    width: 88, height: 88, borderRadius: Radius.full, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.md,
  },
  micButtonActive: { backgroundColor: Colors.danger },

  parseBtn: { width: '100%' },
});
