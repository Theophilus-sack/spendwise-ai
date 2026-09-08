import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Canonical Ionicons glyph per recurring domain concept — so "AI Advisor"
 * or "Goals" isn't represented one way in one screen's header chrome and a
 * completely different way (often a raw emoji) in another screen's content.
 * Add to this map rather than hardcoding a concept's icon name inline again.
 */
export const ConceptIcons = {
  ai:    'chatbubble-ellipses' as IoniconName,
  goals: 'trophy' as IoniconName,
} as const;
