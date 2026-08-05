// Single source for the Claude model used across every edge function that
// calls Anthropic — previously hardcoded independently in 8 places, which
// made a model migration an 8-file manual edit instead of a one-line change.
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
