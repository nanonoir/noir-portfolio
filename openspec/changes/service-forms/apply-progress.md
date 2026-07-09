# Apply Progress: Service Forms

## Mode

Standard mode. Strict TDD is disabled for this project (`strict_tdd: false`); checkpoint verification used the configured build/typecheck path.

## Workload / PR Boundary

- Delivery strategy in task forecast: `ask-on-risk`
- Current completed slice: Phase 1 Foundation + Phase 2 Informational Modals
- Boundary: dependencies, localized form keys, service detail data contracts, Zod schemas, UI primitives, and informational modal wiring
- Next slice: Phase 3 Service Request Forms

## Completed Tasks

- [x] 1.1 Installed `react-hook-form`, `zod`, and `@hookform/resolvers`.
- [x] 1.2 Added `forms` namespace keys to the typed ES/EN dictionary.
- [x] 1.3 Extended the `Service` type and service data with localized detail fields.
- [x] 1.4 Created Zod schemas and inferred types for all five service forms plus the general contact form.
- [x] 1.5 Created reusable `Label`, `FormError`, and `Radio` primitives.
- [x] 1.6 Created a strict single-panel `Accordion` primitive.
- [x] 2.1 Created `ServiceInfoModal` in `src/components/ui/informational-modal.tsx` using `Modal` and `Accordion`.
- [x] 2.2 Populated localized service detail content in `src/data/content.ts` from `openspec/servicesInfo.md`.
- [x] 2.3 Wired `Más info` / `More info` buttons to `ServiceInfoModal`; CTA closes info modal and opens the existing request placeholder.

## Checkpoint 1 Results

- [x] Dependencies installed successfully (`pnpm add react-hook-form zod @hookform/resolvers`).
- [x] Zod schemas compile without errors.
- [x] Accordion component renders as a client component and enforces one open panel through shared parent state.
- [x] i18n keys are typed and available in both ES and EN dictionaries.
- [x] No TypeScript errors in the codebase (`pnpm build` passed).

## Checkpoint 2 Results

- [x] `ServiceInfoModal` renders localized content from `openspec/servicesInfo.md` for the four current service cards.
- [x] Accordion behavior keeps only one detail section open at a time.
- [x] Always-visible intro, ideal-for, result, and CTA sections are not collapsible.
- [x] `Más info` / `More info` opens `ServiceInfoModal` instead of the placeholder modal.
- [x] CTA closes `ServiceInfoModal` and opens the existing request placeholder modal for now.
- [x] ES and EN content smoke-tested in the browser.
- [x] No TypeScript errors in the codebase (`pnpm build` passed).

## Files Created

- `src/components/forms/schemas.ts` — Zod schemas and inferred form value types.
- `src/components/ui/accordion.tsx` — strict single-open accordion primitive.
- `src/components/ui/form-controls.tsx` — form label, error, and radio primitives.
- `src/components/ui/informational-modal.tsx` — localized service information modal using strict accordion sections.

## Files Modified

- `package.json` — added form validation dependencies.
- `pnpm-lock.yaml` — locked installed dependencies.
- `src/lib/i18n.ts` — added typed ES/EN form labels, placeholders, errors, and success copy.
- `src/data/content.ts` — added localized service detail data fields.
- `src/components/sections/static-sections.tsx` — split service info/request state and wired info modal triggers.
- `src/components/ui/index.ts` — exported new UI primitives.
- `openspec/changes/service-forms/tasks.md` — marked Phase 1 and Phase 2 tasks complete.

## Deviations from Design

None — implementation matches the completed Phase 1 and Phase 2 scopes. The service form schemas live together in `schemas.ts` now; explicit per-service React form components remain for Phase 3 as designed.

## Issues / Notes

- The task forecast still says the full change requires a chain strategy decision. This apply batch intentionally stayed within the assigned Phase 2 informational-modal slice.
- Phase 2 intentionally uses the existing request placeholder for the info-modal CTA handoff; the real request form modal remains Phase 3.
- `openspec/servicesInfo.md` only provides informational modal copy for the four current service cards. The custom dark-banner request remains tied to the request placeholder and does not have a `Más info` entry in Phase 2.
