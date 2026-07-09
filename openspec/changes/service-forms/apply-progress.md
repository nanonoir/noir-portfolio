# Apply Progress: Service Forms

## Mode

Standard mode. Strict TDD is disabled for this project (`strict_tdd: false`); checkpoint verification used the configured build/typecheck path.

## Workload / PR Boundary

- Delivery strategy in task forecast: `ask-on-risk`
- Current completed slice: Phase 1 Foundation + Phase 2 Informational Modals + Phase 3 Service Request Forms + Phase 4 Success State & WhatsApp Integration + Phase 5 General Contact Form
- Boundary: dependencies, localized form keys, service detail data contracts, Zod schemas, UI primitives, informational modal wiring, service request form rendering/validation, success state, WhatsApp URL generation, and general contact form validation/toast behavior
- Next slice: Phase 6 Integration & i18n

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
- [x] 4.1 Created `src/components/forms/whatsapp-link.ts` to build encoded WhatsApp URLs from submitted service request data.
- [x] 4.2 Implemented `SuccessState` inside `ServiceRequestModal` and wired valid form submissions to transition into success without closing the modal.
- [x] 5.1 Refactored `ContactSection` in `src/components/sections/static-sections.tsx` to React Hook Form + Zod using `mode: "onBlur"`.
- [x] 5.2 Preserved the existing toast behavior on valid contact form submit and reset the form after success.

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

## Checkpoint 4 Results

- [x] Success state renders after valid form submission.
- [x] `Agendar reunión` renders disabled with tooltip text `Agendá una reunión directamente desde el portfolio — próximamente`.
- [x] `Continuar por WhatsApp →` opens a WhatsApp URL with an encoded pre-filled message.
- [x] WhatsApp message includes contact fields and service-specific fields.
- [x] Empty optional message uses `Sin mensaje adicional` in the WhatsApp message.
- [x] Modal does not auto-close after successful submission.
- [x] X close button still closes the modal from success state.
- [x] Success state and request forms work in ES and EN.
- [x] No TypeScript errors in the codebase (`pnpm build` passed).

## Checkpoint 5 Results

- [x] Contact form uses React Hook Form with `zodResolver(generalContactFormSchema)`.
- [x] Email validation uses the existing Zod `.email()` rule from `generalContactFormSchema`.
- [x] Message validation uses the existing Zod minimum 10-character rule from `generalContactFormSchema`.
- [x] Inline localized error messages render below fields after blur or invalid submit.
- [x] Native validation is disabled with `noValidate`, avoiding browser validation popups.
- [x] Valid submit keeps the existing localized `Toast` behavior and does not render an inline success state or WhatsApp CTA.
- [x] Form resets after successful submission via React Hook Form `reset()`.
- [x] ES and EN labels/placeholders/error messages are covered by the typed dictionary keys.
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
- `src/components/forms/whatsapp-link.ts` — WhatsApp message and URL generation utility.

## Files Modified

- `package.json` — added form validation dependencies.
- `pnpm-lock.yaml` — locked installed dependencies.
- `src/lib/i18n.ts` — added typed ES/EN form labels, placeholders, errors, success copy, meeting tooltip copy, and WhatsApp empty-message fallback.
- `src/components/forms/schemas.ts` — tightened name and phone schema primitives for request form validation.
- `src/components/ui/form-field.tsx` — adjusted input and textarea text sizing to avoid iOS input zoom.
- `src/components/ui/form-controls.tsx` — adjusted label, error, and radio text sizing to avoid iOS input zoom.
- `src/data/content.ts` — added localized service detail data fields.
- `src/components/sections/static-sections.tsx` — wired service request state to `ServiceRequestModal` and info-modal handoff.
- `src/components/forms/service-request-modal.tsx` — added success state and submit-to-success transition.
- `src/components/sections/static-sections.tsx` — refactored `ContactSection` to React Hook Form + Zod validation while preserving toast UX.
- `src/components/ui/index.ts` — exported new UI primitives.
- `openspec/changes/service-forms/tasks.md` — marked Phase 1, Phase 2, Phase 3, Phase 4, and Phase 5 tasks complete.

## Deviations from Design

None — implementation matches the completed Phase 1, Phase 2, Phase 3, Phase 4, and Phase 5 scopes. Backend/API submission remains out of scope.

## Issues / Notes

- The task forecast still says the full change requires a chain strategy decision. This apply batch intentionally stayed within the assigned Phase 5 general contact form slice.
- Phase 4 keeps local `console.log` for accepted requests and transitions to success state; real backend/API submission remains out of scope.
- `openspec/servicesInfo.md` only provides informational modal copy for the four current service cards. The custom dark-banner service now opens the custom request form directly and still has no `Más info` entry.
