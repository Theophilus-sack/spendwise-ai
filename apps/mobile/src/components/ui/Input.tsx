import React, { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, TouchableOpacity,
  TextInputProps, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label, error, hint, leftIcon, rightIcon, onRightIconPress,
  containerStyle, isPassword = false, ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const secureIcon = showPassword ? 'eye-off-outline' : 'eye-outline';

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputWrapper,
        focused && styles.focused,
        !!error && styles.hasError,
      ]}>
        {leftIcon && (
          <Ionicons name={leftIcon} size={18} color={Colors.textSecondary} style={styles.leftIcon} />
        )}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithLeft, (rightIcon || isPassword) && styles.inputWithRight]}
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.rightIcon}>
            <Ionicons name={secureIcon} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons name={rightIcon} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { gap: 6 },
  label:        { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    minHeight: 52,
  },
  focused:       { borderColor: Colors.primary, backgroundColor: Colors.surface },
  hasError:      { borderColor: Colors.danger },
  input:         { flex: 1, fontSize: Typography.base, color: Colors.text, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  inputWithLeft: { paddingLeft: Spacing.sm },
  inputWithRight:{ paddingRight: Spacing.sm },
  leftIcon:      { paddingLeft: Spacing.base },
  rightIcon:     { paddingRight: Spacing.base },
  error:         { fontSize: Typography.xs, color: Colors.danger },
  hint:          { fontSize: Typography.xs, color: Colors.textSecondary },
});
