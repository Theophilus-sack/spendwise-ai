import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme';

interface Props {
  children: React.ReactNode;
  /** Short label used in the fallback message, e.g. "the chat". */
  label: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render/lifecycle errors in whatever it wraps so one broken native
 * component (e.g. a scroll command failing on a particular device/build)
 * shows a small recoverable message instead of red-screening the whole app.
 * Only a class component can implement this — there's no hook equivalent.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Intentionally no logging service here — just contain the crash.
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong with {this.props.label}</Text>
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  title:     { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  button:    { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  buttonText:{ color: '#fff', fontSize: Typography.base, fontWeight: Typography.semibold },
});
