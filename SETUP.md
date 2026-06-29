# SpendWise AI — Setup Guide

## Prerequisites

- Node.js 18+ or Bun 1.0+
- Expo CLI: `npm install -g expo-cli`
- Supabase CLI: https://supabase.com/docs/guides/cli
- An Anthropic API key (get one at console.anthropic.com)

---

## 1. Install dependencies

```bash
cd apps/mobile
bun install
```

---

## 2. Create your Supabase project

1. Go to https://supabase.com and create a new project
2. Copy your **Project URL** and **anon public key** from Settings → API
3. Create `apps/mobile/.env` from the example:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Then fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 3. Run the database migration

```bash
supabase link --project-ref your-project-id
supabase db push
```

---

## 4. Deploy Edge Functions

```bash
# Set your Anthropic API key as a Supabase secret
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Deploy all functions
supabase functions deploy ai-advisor
supabase functions deploy categorize-expense
supabase functions deploy ocr-receipt
supabase functions deploy detect-anomaly
supabase functions deploy compute-fds
supabase functions deploy parse-nlp-expense
```

---

## 5. Start the app

```bash
cd apps/mobile
bun run start
```

Scan the QR code with Expo Go on your phone, or press `a` for Android emulator / `i` for iOS simulator.

---

## Project Structure

```
spendwise-ai/
├── apps/mobile/          # React Native + Expo app
│   ├── App.tsx           # Entry point
│   ├── src/
│   │   ├── components/ui/   # Design system components
│   │   ├── navigation/      # All navigators
│   │   ├── screens/         # All screens
│   │   ├── store/           # Zustand state
│   │   ├── lib/             # Supabase client + SQLite
│   │   └── theme/           # Colours, typography, spacing
├── packages/shared/      # Shared TypeScript (used by app + Edge Functions)
│   └── src/
│       ├── types.ts         # All domain types
│       ├── constants.ts     # Categories, badges, currencies
│       ├── fds.ts           # Financial Discipline Score algorithm
│       ├── forecast.ts      # Weighted exponential smoothing forecast
│       ├── anomaly.ts       # Modified Z-score anomaly detection
│       └── utils.ts         # Formatting, date helpers
└── supabase/
    ├── migrations/          # Database schema
    ├── functions/           # 6 AI Edge Functions
    └── config.toml
```

---

## What's fully built (Phase 1 complete)

- [x] Auth (Login, Sign Up, session persistence)
- [x] 7-step onboarding wizard with AI budget generation
- [x] Expense CRUD (form mode + NLP quick-add mode)
- [x] Budget tracking with animated progress bars
- [x] Dashboard with balance, stats, AI insight banner
- [x] Spending Forecast (weighted exponential smoothing)
- [x] AI Advisor chat (Claude API with financial context injection)
- [x] Receipt Scanner (camera + Claude vision)
- [x] Auto-categorization (Claude haiku few-shot + local fallback)
- [x] Anomaly detection (Modified Z-score, Iglewicz-Hoaglin)
- [x] Financial Discipline Score (FDS formula + weekly cron)
- [x] Achievements screen (20 badges defined)
- [x] Score Detail screen with component breakdown
- [x] Offline-first (SQLite + Supabase sync)
- [x] Complete Supabase schema with RLS policies
- [x] 6 AI Edge Functions deployed

## What's next (Phase 2–4)

- [ ] Goals module with AI savings plan
- [ ] Income tracking (multi-source, recurring)
- [ ] Debt tracker with repayment timeline
- [ ] Full analytics charts (Victory Native)
- [ ] What-If simulator
- [ ] Spending heatmap (K-Means trigger profiling)
- [ ] Push notifications (budget alerts, anomaly alerts)
- [ ] Weekly Reflection with AI response
- [ ] PDF/CSV export
- [ ] Financial Literacy Hub
- [ ] Round-up micro-savings
