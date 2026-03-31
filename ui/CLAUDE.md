# CLAUDE.md — rapida.ai Voice AI Frontend

This file provides context for Claude Code when working in this codebase.

---

## Project Overview

**rapida.ai** is a Voice AI platform dashboard. The UI manages assistants, deployments (endpoints), knowledge bases, integrations, credentials, user accounts, and observability (logs/traces). It communicates with backend services via the `@rapidaai/react` SDK (REST + gRPC-Web).

---

## Tech Stack

| Concern | Tool |
|---|---|
| Framework | React 18.2 + TypeScript 4.6.4 |
| Build | Create React App + CRACO (custom webpack) |
| Package manager | **Yarn** (always use `yarn`, never `npm`) |
| Styling | Tailwind CSS v4 + styled-components + Material Tailwind |
| State | Zustand 4 (primary), Redux Toolkit + Redux Saga (secondary/legacy) |
| Routing | React Router DOM v6 |
| API layer | `@rapidaai/react` SDK + SWR |
| Forms | React Hook Form 7 |
| i18n | react-i18next |
| Charts | ECharts (primary), Recharts, Chart.js |
| Code editor | Monaco Editor |
| Protobuf/gRPC | `@protobuf-ts` + `@improbable-eng/grpc-web` |
| Animations | Framer Motion |
| Notifications | react-hot-toast |
| Linting | ESLint + Prettier + Stylelint |
| Commit format | Conventional Commits (commitlint + standard-version) |
| Testing | Jest + @testing-library/react (90% coverage threshold) |
| Error tracking | Sentry (`@sentry/react`) |
| Analytics | Google Analytics 4 (`react-ga4`) |

---

## Commands

```bash
# Development (starts Tailwind watcher + CRACO dev server concurrently)
yarn start

# Production build (compiles CSS then CRACO build)
yarn build

# Type check only (no emit)
yarn checkTs

# Lint
yarn lint
yarn lint:fix

# Tests
yarn test
yarn test:coverage

# Release (bumps version + generates CHANGELOG)
yarn release
```

---

## Project Structure

```
src/
├── app/
│   ├── components/       # Shared/reusable UI components
│   ├── pages/            # Route-level page components (feature-scoped)
│   │   ├── assistant/
│   │   ├── authentication/
│   │   ├── endpoint/
│   │   ├── knowledge-base/
│   │   ├── connect/
│   │   └── ...
│   └── routes/           # Route definitions (one file per route group)
├── configs/
│   ├── config.development.json   # Dev environment settings
│   ├── config.production.json    # Prod environment settings
│   └── index.ts                  # Typed config loader + connectionConfig export
├── context/
│   ├── auth-context.tsx
│   ├── dark-mode-context.tsx
│   ├── provider-context.tsx
│   └── sidebar-context.tsx
├── hooks/                # Page-scoped Zustand store hooks (use-*-page-store.ts)
├── models/               # Shared domain models (common, datasets, notification, prompt)
├── providers/            # AI provider metadata (per provider directory + JSON files)
├── styles/
│   ├── tailwind.css              # Tailwind v4 entry (uses @import, not @tailwind directives)
│   ├── generated/tailwindcss.css # Auto-generated — DO NOT edit manually
│   └── global-styles.ts          # styled-components global styles
├── types/                # TypeScript types per domain (types.assistant.ts, etc.)
├── utils/                # Pure utility functions
├── workspace/            # Workspace-level provider/context
└── index.tsx             # App entry point
```

---

## Path Aliases

Use `@/` for all internal imports — it maps to `./src/`.

```ts
// Correct
import { useAssistantPageStore } from '@/hooks/use-assistant-page-store';
import { CONFIG } from '@/configs';

// Wrong — never use relative paths that traverse directories
import { CONFIG } from '../../../configs';
```

---

## Architecture Patterns

### Configuration

Config is loaded from JSON files based on `NODE_ENV` in `src/configs/index.ts`. Import `CONFIG` and `connectionConfig` from `@/configs`. Never read `process.env` directly outside of `src/configs/index.ts`.

```ts
import { CONFIG, connectionConfig } from '@/configs';
```

Feature flags live in `CONFIG.workspace.features` (e.g. `knowledge`, `telemetry`). Gate features behind checks like:

```tsx
{CONFIG.workspace.features?.knowledge !== false && <KnowledgeRoute />}
```

### State Management — Zustand (preferred)

Every page feature has a dedicated Zustand store hook in `src/hooks/`. Pattern:

- File: `use-<feature>-page-store.ts` (kebab-case)
- Export: `useXxxPageStore` (camelCase)
- Store state is split: initial property object + `create<Type>((set, get) => ({ ... }))`

```ts
import { create } from 'zustand';
import { SomeDomainType } from '@/types';

const initialState: SomeDomainTypeProperty = { ... };

export const useSomePageStore = create<SomeDomainType>((set, get) => ({
  ...initialState,
  fetchItems: async () => { ... },
}));
```

### API Calls

Use the `@rapidaai/react` SDK. Pass `connectionConfig` from `@/configs` to SDK methods. Handle `ServiceError` for error states.

```ts
import { GetAssistant } from '@rapidaai/react';
import { ServiceError } from '@rapidaai/react';
import { connectionConfig } from '@/configs';
```

### Types

Domain types live in `src/types/types.<domain>.ts`. Export all types through `src/types/index.ts`.

Naming conventions:
- Page store state shape: `XxxTypeProperty`
- Page store full type (state + actions): `XxxType`

### Dark Mode

Dark mode is context-driven via `DarkModeProvider`. Use Tailwind `dark:` variant — CSS supports both `prefers-color-scheme: dark` media query and `.dark` class selector.

---

## Code Style

- **TypeScript**: `strict: true`. `noImplicitAny: false` is set but avoid `any` where possible. Prefer explicit types on public function signatures.
- **File naming**: kebab-case for all files (`use-endpoint-page-store.ts`, `audio-player/index.tsx`).
- **Component naming**: PascalCase React components.
- **Hook naming**: `use` prefix, camelCase.
- **No default exports** for hooks/utilities — use named exports. Page components may use default exports.
- **No new barrel files** for single items — don't create an `index.ts` just to re-export one thing.
- **Tailwind over inline styles**: Use Tailwind utility classes. Use `clsx` or `tailwind-merge` for conditional class composition.
- **JSDoc on Zustand store actions** — add brief JSDoc comments (see existing stores as reference).

---

## Styling

- Tailwind v4 uses `@import 'tailwindcss'` syntax — not v3 `@tailwind base/components/utilities` directives.
- The generated CSS file (`src/styles/generated/tailwindcss.css`) is built by `yarn tailwind:watch` / `yarn build:css`. **Never edit it manually.**
- Use `styled-components` only for complex dynamic styles that Tailwind cannot express.
- Material Tailwind (`@material-tailwind/react`) is available for form controls and overlays.

---

## Routing

Routes are split by feature in `src/app/routes/`. Each route file exports a named route component (e.g. `DashboardRoute`). All are assembled in `src/app/index.tsx` using React Router v6 `<Routes>`.

To add a new route group:
1. Create `src/app/routes/<feature>.tsx`
2. Export it from `src/app/routes/index.ts`
3. Register the route in `src/app/index.tsx`

---

## Commit Convention

Commits follow Conventional Commits, enforced by commitlint + husky. Types are defined in `.versionrc.js`. Examples:

```
feat(assistant): add voice cloning provider selector
fix(endpoint): correct connection timeout handling
chore(deps): upgrade wavesurfer.js to 7.10.1
refactor(hooks): simplify use-endpoint-page-store pagination
```

---

## Testing

- Test files: `*.test.ts(x)` co-located with source or in `__tests__/` subdirectory.
- Use `@testing-library/react` for component tests. Avoid testing implementation details.
- Coverage threshold is **90%** (branches, functions, lines, statements). Do not lower it.
- Run `yarn test:coverage` before submitting changes to confirm coverage is maintained.

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `@rapidaai/react` | Core SDK — all backend API calls |
| `@rapidaai/react-widget` | Embeddable widget component |
| `zustand` | Page-level state management |
| `react-hook-form` | Form state and validation |
| `wavesurfer.js` | Audio waveform visualisation |
| `@monaco-editor/react` | Code/prompt editor |
| `echarts-for-react` | Primary charting library |
| `react-i18next` | Internationalisation |
| `dayjs` / `moment` | Date handling — prefer `dayjs` for new code |
| `lodash-es` | Utility functions (ES module build, tree-shakeable) |
| `framer-motion` | Animations |
| `ahooks` | React hook utilities |
| `swr` | Data fetching with caching |

---

## Environment Files

- `src/configs/config.development.json` — local dev API URLs, feature flags
- `src/configs/config.production.json` — production settings
- `src/providers/provider.development.json` / `provider.production.json` — AI provider metadata per environment
- `.env.production` — build-time env vars (do not commit secrets)

When adding a new config key, update the typed interface in `src/configs/index.ts`.

---

## Do Not

- Do not run `npm install` — always use `yarn`.
- Do not edit `src/styles/generated/tailwindcss.css` manually.
- Do not add Redux slices for new features — use Zustand.
- Do not import from `lodash` (CommonJS build) — use `lodash-es`.
- Do not skip the `connectionConfig` parameter when calling SDK methods.
- Do not hardcode API URLs — always use `CONFIG.connection.*`.
- Do not use `moment` for new code — use `dayjs`.
