# SpendWise AI — Presentation Walkthrough

A spoken-style script to take your lecturer through the project. Each section has a short "say this" version and supporting detail you can fall back on if asked questions.

---

## 1. Opening (30 seconds)

> "My project is called **SpendWise AI** — a smart personal expense tracker that doesn't just record spending, but actively measures and improves the user's financial discipline using AI and statistical methods. Let me walk you through the problem, my solution, and what I've built so far."

---

## 2. The Problem (talk more on this)

**Say:**
> "The problem isn't that budgeting apps don't exist — it's that they fail in three specific ways."

**Then explain each point clearly:**

1. **People stop tracking.**
   "Manual expense logging is tedious. Studies and common experience show most people abandon budgeting apps within weeks, so the app never has enough data to actually help."

2. **No feedback on *behavior*, only on numbers.**
   "Existing apps show you a pie chart of where your money went. They don't tell you whether your *habits* are improving or getting worse. There's no equivalent of a credit score for everyday spending discipline."

3. **Anomalies are missed.**
   "If you suddenly spend way more than usual in one category, most apps either don't notice, or they use a basic statistical method — standard deviation — that doesn't work well because personal spending data is irregular and skewed, not a normal bell curve."

4. **Budgets are static.**
   "You set a budget once, and the app just tracks against it. It doesn't predict whether you're on pace to blow the budget before the month ends."

5. **No guidance.**
   "The user is left alone with numbers — no one explains *why* something happened or *what to do about it*."

**Close this section:**
> "So the gap isn't 'build another tracker' — it's: can we combine robust statistics, forecasting, and AI guidance to actually change financial behavior, and measure that change?"

---

## 3. The Solution

**Say:**
> "SpendWise AI adds four research-backed components on top of normal expense tracking."

1. **Financial Discipline Score (FDS)**
   "A single score, like a credit score, but for spending habits. It combines budget adherence (35%), savings rate (30%), consistency (20%), and improvement trend (15%), smoothed over time using exponential moving average so it doesn't jump around too much."

2. **Anomaly Detection**
   "I use the *Modified Z-score* method — based on median absolute deviation, from Iglewicz & Hoaglin (1993) — instead of standard deviation. This is more robust because it isn't thrown off by a few extreme outliers, which is exactly what personal spending data looks like."

3. **Forecasting**
   "Using *Weighted Exponential Smoothing*, the app predicts where your balance and category spending will end up by month-end, so budgets become predictive instead of just a record."

4. **AI Advisor**
   "A chat assistant powered by Claude — it explains why your score changed, answers 'what if I cut my coffee spending by half' type questions, and gives plain-language advice. I use a smaller fast model (Claude Haiku) for quick tasks like categorizing expenses, and a more capable model (Claude Sonnet) for the advisory conversations."

**If asked "why is this novel / not just an app":**
> "Because none of these four pieces individually is new — but combining a robust statistical anomaly method, adaptive forecasting, a composite discipline metric, and AI explanation into one coherent, personalized system — and testing whether it improves user behavior — is the contribution."

---

## 4. What I've Built So Far (demo-ready)

**Say:**
> "The system is a monorepo with three parts: the mobile app, a shared algorithms package, and the Supabase backend."

**Walk through screens (ideally live on the phone via Expo Go):**
- Auth & onboarding — sign up, login, 7-step onboarding wizard
- Dashboard — overview of spending, score, budget status
- Expenses — add/view expenses, including a Receipt Scanner (OCR)
- Budget, Income, Debts, Goals — full financial picture, not just expenses
- Analytics & Forecast — charts and projections
- Score Detail — breakdown of the FDS
- What-If Simulator — "what happens to my score if I change X"
- AI Advisor — chat interface

**Backend (mention, don't need to show code):**
> "On the backend, I have six serverless functions: one computes the FDS, one detects anomalies, one parses natural-language expense entries like 'spent 20 on lunch', one auto-categorizes expenses with AI, one processes receipt OCR, and one powers the AI advisor chat. All of this sits on a PostgreSQL database with row-level security, so each user's data is isolated."

**Close:**
> "Right now, the full app runs end-to-end on Expo Go — all 16 screens and all six AI/algorithm functions are implemented. The next phase is refining the charts, adding push notifications for alerts, and — most importantly for the academic side — running user testing to evaluate whether the FDS and AI advisor actually improve financial discipline."

---

## 5. Anticipated Questions & Short Answers

- **"How do you validate the anomaly detection works?"**
  → "Next step is testing it against simulated and real transaction datasets, comparing flagged anomalies against ground truth/manual review."

- **"Why Claude over other LLMs?"**
  → "Claude Haiku gives low latency for frequent small tasks like categorization, and Claude Sonnet gives stronger reasoning for the advisory chat — a tiered approach balances cost and quality."

- **"What's the evaluation metric for success?"**
  → "Primarily: change in FDS over time for test users, accuracy of anomaly detection vs. manual labeling, and forecast error (e.g., MAPE) for the spending projections."

- **"What's left?"**
  → "Charts polish, push notifications, and the user evaluation study — the core system is functionally complete."
