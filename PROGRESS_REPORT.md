# SpendWise AI — Project Progress Report

**Project Title:** SpendWise AI — Smart Personal Expense Tracking & Budget Management System with AI-Driven Financial Discipline

**Prepared for:** Supervisor Review
**Date:** 12 June 2026

---

## 1. Problem Statement

Personal financial mismanagement remains one of the most common causes of financial stress, despite the wide availability of budgeting and expense-tracking applications. The core issues this project addresses are:

1. **Poor adherence to expense tracking** — Manual logging is tedious, so most users abandon budgeting apps within a few weeks, losing the data needed to build useful financial habits.

2. **Lack of behavioral feedback** — Existing apps show users *what* they spent, but rarely *how disciplined* their spending behavior is over time, or *why* it matters. There is no equivalent of a "credit score" for day-to-day spending discipline.

3. **Reactive, not proactive, anomaly awareness** — Unusual or risky spending (e.g., a sudden spike in a category) is typically noticed only after the fact, if at all. Most apps that do flag anomalies use simple standard-deviation thresholds, which perform poorly on the skewed, irregular distributions typical of personal spending data.

4. **Static budgets** — Budgets are usually fixed figures set once and rarely adjusted. They do not forecast whether a user is on track to overspend by month-end, nor adapt based on actual income and spending trends.

5. **No personalized guidance** — Users are left to interpret raw numbers and charts themselves, with no conversational or explanatory layer to help them understand their financial behavior and make better decisions.

**Why this is a valid research problem (not just an app):** A simple "alert if spend > budget" rule-based system would not constitute a meaningful academic contribution. The novelty of this project lies in combining **robust statistical anomaly detection**, **adaptive time-series forecasting**, a **composite financial discipline metric**, and **conversational AI guidance** into a single, personalized system — and evaluating whether this combination measurably improves financial discipline outcomes for users.

---

## 2. Proposed Solution

SpendWise AI is a cross-platform mobile application (React Native + Expo) backed by a Supabase (PostgreSQL) database and serverless Edge Functions, with the following original components layered on top of standard expense tracking:

### 2.1 Financial Discipline Score (FDS)
A composite, exponentially-smoothed metric that gives users a single, interpretable score representing their financial discipline, calculated from:
- Budget adherence — 35%
- Savings rate — 30%
- Consistency of tracking/spending — 20%
- Improvement trend over time — 15%

The score is smoothed using Exponential Moving Average (EMA) so that short-term fluctuations do not cause erratic swings, while still reflecting genuine behavioral change.

### 2.2 Anomaly Detection
Unusual transactions are flagged using the **Iglewicz-Hoaglin Modified Z-score** (a Median Absolute Deviation–based method, Iglewicz & Hoaglin, 1993), which is robust to outliers and skewed distributions — a significant improvement over naive standard-deviation-based thresholds commonly used in existing apps.

### 2.3 Forecasting
**Weighted Exponential Smoothing** is applied to historical spending and income data to project end-of-month balances and category spend, turning budgets from static targets into predictive tools that warn users before they overspend.

### 2.4 AI Advisor
A conversational assistant powered by the **Claude API**:
- **Claude Haiku 4.5** — used for fast, low-latency tasks: automatic expense categorization, natural-language expense entry parsing, and receipt OCR interpretation.
- **Claude Sonnet 4.6** — used for the advisory chat experience: explaining score changes, answering "what if" budgeting questions, and providing personalized financial guidance in plain language.

---

## 3. What Has Been Integrated So Far

### 3.1 Architecture
The project is structured as a monorepo:
- `apps/mobile` — React Native (Expo) mobile application
- `packages/shared` — shared TypeScript types and core algorithms (FDS, anomaly detection, forecasting, categorization)
- `supabase` — PostgreSQL schema, Row-Level Security policies, and Edge Functions

### 3.2 Mobile Application Screens (16 implemented)
- **Authentication:** Splash, Login, Sign-Up
- **Onboarding:** 7-step guided onboarding wizard
- **Core features:** Dashboard, Expenses, Add Expense, Budget, Analytics, Forecast, Goals, Income, Debts
- **AI features:** Receipt Scanner, AI Advisor chat
- **Discipline tracking:** Achievements, Score Detail, What-If Simulator
- **Account:** Profile

### 3.3 Backend — Supabase Edge Functions (6 implemented)
| Function | Purpose |
|---|---|
| `compute-fds` | Calculates the Financial Discipline Score |
| `detect-anomaly` | Flags anomalous transactions using Modified Z-score |
| `parse-nlp-expense` | Converts natural-language input (e.g., "spent 20 on lunch") into structured expense records |
| `categorize-expense` | AI-powered automatic expense categorization (Claude Haiku) |
| `ocr-receipt` | Extracts structured data from photographed receipts |
| `ai-advisor` | Conversational financial advisor (Claude Sonnet) |

### 3.4 Database
A complete PostgreSQL schema with Row-Level Security (RLS) policies ensuring each user can only access their own financial data — a requirement for any multi-user financial application.

### 3.5 Shared Algorithm Package
Core logic for FDS calculation, anomaly detection, forecasting, and categorization is implemented once in `packages/shared` and consumed by both the mobile app and the Edge Functions, ensuring consistency between client and server calculations.

### 3.6 Current Status
The application builds and runs on Expo Go for live demonstration and testing. All core screens and AI-driven features (scoring, anomaly detection, forecasting, AI advisor chat, goals, income, debt tracking, and the what-if simulator) are implemented end-to-end.

---

## 4. Next Steps

- Expand and refine charting/visualizations (Victory Native) across Analytics and Forecast screens
- Implement push notifications for budget alerts and anomaly notifications
- Conduct user testing to evaluate whether the FDS and AI advisor measurably improve financial discipline over time
- Begin evaluation/validation of the anomaly detection and forecasting algorithms against real/simulated transaction datasets
