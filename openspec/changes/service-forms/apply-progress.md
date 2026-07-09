# Apply Progress: Service Forms

## Mode

Standard mode. Strict TDD is disabled for this project (`strict_tdd: false`); checkpoint verification used the configured build/typecheck path.

## Workload / PR Boundary

- Delivery strategy in task forecast: `ask-on-risk`
- Current assigned slice: Phase 1 Foundation only
- Boundary: dependencies, localized form keys, service detail data contracts, Zod schemas, and UI primitives
- Next slice: Phase 2 Informational Modals

## Completed Tasks

- [x] 1.1 Installed `react-hook-form`, `zod`, and `@hookform/resolvers`.
- [x] 1.2 Added `forms` namespace keys to the typed ES/EN dictionary.
- [x] 1.3 Extended the `Service` type and service data with localized detail fields.
- [x] 1.4 Created Zod schemas and inferred types for all five service forms plus the general contact form.
- [x] 1.5 Created reusable `Label`, `FormError`, and `Radio` primitives.
- [x] 1.6 Created a strict single-panel `Accordion` primitive.

## Checkpoint 1 Results

- [x] Dependencies installed successfully (`pnpm add react-hook-form zod @hookform/resolvers`).
- [x] Zod schemas compile without errors.
- [x] Accordion component renders as a client component and enforces one open panel through shared parent state.
- [x] i18n keys are typed and available in both ES and EN dictionaries.
- [x] No TypeScript errors in the codebase (`pnpm build` passed).

## Files Created

- `src/components/forms/schemas.ts` — Zod schemas and inferred form value types.
- `src/components/ui/accordion.tsx` — strict single-open accordion primitive.
- `src/components/ui/form-controls.tsx` — form label, error, and radio primitives.

## Files Modified

- `package.json` — added form validation dependencies.
- `pnpm-lock.yaml` — locked installed dependencies.
- `src/lib/i18n.ts` — added typed ES/EN form labels, placeholders, errors, and success copy.
- `src/data/content.ts` — added localized service detail data fields.
- `src/components/ui/index.ts` — exported new UI primitives.
- `openspec/changes/service-forms/tasks.md` — marked Phase 1 tasks complete.

## Deviations from Design

None — implementation matches the Phase 1 foundation scope. The service form schemas live together in `schemas.ts` now; explicit per-service React form components remain for Phase 3 as designed.

## Issues / Notes

- The task forecast still says the full change requires a chain strategy decision. This apply batch intentionally stayed within the assigned Phase 1 foundation slice.
- No previous apply-progress artifact existed, so this file is the initial cumulative progress record.
