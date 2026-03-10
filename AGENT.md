# AGENT.md - Elder-Guard AI (Demo Version) Context

## Project Overview & Goal
Elder-Guard AI is a proactive monitoring platform for elderly individuals. This is a demo/MVP version focusing on rapid development. The system collects local sensor data via a mobile application, sends it to the cloud, computes an anomaly score, and alerts guardians via a web dashboard and mobile notifications. Privacy compliance (KVKK) is temporarily deprioritized for this demo phase.

## Tech Stack
- **Monorepo:** Turborepo with pnpm
- **Frontend (Web):** Next.js 14.x (App Router), Tailwind CSS, shadcn/ui, Zustand
- **Frontend (Mobile):** React Native (Expo SDK 50+ with Prebuild), Zustand
- **Backend & Database:** Firebase (Authentication, Firestore, Cloud Functions)
- **Validation:** Zod
- **Testing:** Jest

## Strict Versioning Rule
CRITICAL: All dependencies in every `package.json` file MUST be pinned to exact versions. Remove all caret (^) and tilde (~) symbols before executing any installation commands. Dependency drift is strictly prohibited.

## Coding Standards
1. **TypeScript Strict Mode:** All TypeScript projects must have `"strict": true` in `tsconfig.json`. Use of `any` is forbidden.
2. **Monorepo Imports:** Internal packages must be imported using workspace aliases (e.g., `@elder-guard/core`, `@elder-guard/firebase-config`).
3. **Naming Conventions:** - Directories and file names: `kebab-case`.
   - Classes and Types: `PascalCase`.
   - Variables and Functions: `camelCase`.
   - Firestore Collections: `camelCase` (plural).

## Error Handling & Architecture
1. **Firebase Security Rules:** Implement basic Firestore rules to ensure authenticated users can only read/write their associated data.
2. **State Management:** Use Zustand for global state in both Next.js and React Native.
3. **Cloud Functions:** Keep functions modular. Offload heavy processing (like anomaly scoring) to Cloud Functions triggered by Firestore writes.