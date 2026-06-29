import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Colours ──────────────────────────────────────────────────────────────────

export const Colors = {
  primary:       '#1A6B4A',
  primaryLight:  '#2ECC71',
  primaryDark:   '#145238',
  accent:        '#F5A623',
  accentDark:    '#D4891A',

  success:       '#2ECC71',
  warning:       '#F39C12',
  danger:        '#E74C3C',
  dangerLight:   '#FADBD8',
  info:          '#3498DB',

  // Neutrals
  text:          '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  textInverse:   '#FFFFFF',

  border:        '#E5E7EB',
  borderStrong:  '#D1D5DB',

  surface:       '#FFFFFF',
  surfaceAlt:    '#F8FAFC',
  background:    '#F1F5F9',

  // Dark mode
  dark: {
    background:    '#0F1117',
    surface:       '#1A1D27',
    surfaceAlt:    '#252836',
    text:          '#F1F5F9',
    textSecondary: '#9CA3AF',
    border:        '#2D3748',
  },

  // Score grades
  gradeA: '#2ECC71',
  gradeB: '#1A6B4A',
  gradeC: '#F5A623',
  gradeD: '#E67E22',
  gradeF: '#E74C3C',

  // Category colours (matches shared/constants)
  categories: {
    food:          '#FF6B6B',
    transport:     '#4ECDC4',
    groceries:     '#45B7D1',
    bills:         '#96CEB4',
    shopping:      '#F5A623',
    entertainment: '#DDA0DD',
    health:        '#98D8C8',
    education:     '#F7DC6F',
    rent:          '#A8D8EA',
    savings:       '#2ECC71',
    other:         '#BDC3C7',
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const Typography = {
  // Sizes
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  28,
  xxxl: 36,

  // Weights (React Native uses string literals)
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,

  // Line heights
  tight:   1.2,
  normal:  1.5,
  relaxed: 1.75,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const Radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: '#1A6B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ─── Screen Dimensions ────────────────────────────────────────────────────────

export const Screen = {
  width:  SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  paddingH: Spacing.base,
} as const;

// ─── Z-Index ──────────────────────────────────────────────────────────────────

export const ZIndex = {
  base:    1,
  card:    10,
  modal:   100,
  overlay: 200,
  toast:   300,
} as const;
