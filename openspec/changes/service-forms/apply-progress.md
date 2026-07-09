# Apply Progress: Service Forms

## Mode

Standard mode. Strict TDD is disabled for this project (`strict_tdd: false`); checkpoint verification used the configured build/typecheck path.

## Workload / PR Boundary

- Delivery strategy in task forecast: `ask-on-risk`
- Current completed slice: Phase 1 Foundation + Phase 2 Informational Modals + Phase 3 Service Request Forms
- Boundary: dependencies, localized form keys, service detail data contracts, Zod schemas, UI primitives, informational modal wiring, and service request form rendering/validation
- Next slice: Phase 4 Success State & WhatsApp Integration

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
- [x] 3.1 Created `ServiceRequestModal` and shared request form shell using React Hook Form with `mode: "onBlur"`.
- [x] 3.2 Created the Auditoría Web request form.
- [x] 3.3 Created the Landing Page request form with conditional brand/company field.
- [x] 3.4 Created the E-commerce request form.
- [x] 3.5 Created the Automations request form.
- [x] 3.6 Created the Custom Service request form for the dark banner.

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

## Checkpoint 3 Results

- [x] All 5 forms render with the correct fields: Web Audit, Landing, E-commerce, Automations, and Custom Service.
- [x] Landing conditional field works: selecting `Brand / company` renders the brand/company field and validates it as required.
- [x] Form validation is configured with React Hook Form `mode: "onBlur"`.
- [x] Field errors render below inputs and radio groups; a global required-fields alert appears after invalid submit.
- [x] `Solicitar` / `Request` opens the correct request form for each service card and the custom dark-banner action.
- [x] `ServiceInfoModal` CTA closes the info modal and opens the matching request form.
- [x] Form state resets on modal close via unmounting.
- [x] ES and EN labels, helpers, and validation messages smoke-tested in the browser.
- [x] No TypeScript errors in the codebase (`pnpm build` passed).

## Files Created

- `src/components/forms/schemas.ts` — Zod schemas and inferred form value types.
- `src/components/ui/accordion.tsx` — strict single-open accordion primitive.
- `src/components/ui/form-controls.tsx` — form label, error, and radio primitives.
- `src/components/ui/informational-modal.tsx` — localized service information modal using strict accordion sections.
- `src/components/forms/service-form-fields.tsx` — shared accessible request-form field and shell helpers.
- `src/components/forms/service-request-modal.tsx` — request modal shell that selects the service-specific form.
- `src/components/forms/service-form-audit.tsx` — Web Audit request form.
- `src/components/forms/service-form-landing.tsx` — Landing Page request form with conditional brand/company field.
- `src/components/forms/service-form-ecommerce.tsx` — E-commerce request form.
- `src/components/forms/service-form-automation.tsx` — Automations request form.
- `src/components/forms/service-form-custom.tsx` — Custom Service request form.

## Files Modified

- `package.json` — added form validation dependencies.
- `pnpm-lock.yaml` — locked installed dependencies.
- `src/lib/i18n.ts` — added typed ES/EN form labels, placeholders, errors, and success copy.
- `src/components/forms/schemas.ts` — tightened name and phone schema primitives for request form validation.
- `src/components/ui/form-field.tsx` — adjusted input and textarea text sizing to avoid iOS input zoom.
- `src/components/ui/form-controls.tsx` — adjusted label, error, and radio text sizing to avoid iOS input zoom.
- `src/data/content.ts` — added localized service detail data fields.
- `src/components/sections/static-sections.tsx` — wired service request state to `ServiceRequestModal` and info-modal handoff.
- `src/components/ui/index.ts` — exported new UI primitives.
- `openspec/changes/service-forms/tasks.md` — marked Phase 1, Phase 2, and Phase 3 tasks complete.

## Deviations from Design

None — implementation matches the completed Phase 1, Phase 2, and Phase 3 scopes. Phase 3 logs valid submissions locally and keeps the modal open; success/WhatsApp behavior remains for Phase 4.

## Issues / Notes

- The task forecast still says the full change requires a chain strategy decision. This apply batch intentionally stayed within the assigned Phase 3 service-request-form slice.
- Phase 3 intentionally logs valid submissions with `console.log` only. Success state and WhatsApp generation remain Phase 4.
- `openspec/servicesInfo.md` only provides informational modal copy for the four current service cards. The custom dark-banner service now opens the custom request form directly and still has no `Más info` entry.
