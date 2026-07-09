# Tasks: Service Forms

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–1000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation + Info modals → PR 2: Service forms + Success → PR 3: Contact + Integration |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + informational modals | PR 1 | Base `main`; Accordion, schemas, content |
| 2 | Service request forms + success/WhatsApp | PR 2 | Targets PR 1; 5 explicit form components |
| 3 | General contact + integration/i18n | PR 3 | Targets PR 2; wires triggers, removes placeholder |

## Phase 1: Foundation

- [x] 1.1 Install `react-hook-form`, `zod`, `@hookform/resolvers`.
- [x] 1.2 Add form namespace keys to `src/lib/i18n.ts`.
- [x] 1.3 Extend `Service` type and `services` data in `src/data/content.ts` with detail fields.
- [x] 1.4 Create Zod schemas and inferred types in `src/components/forms/schemas.ts`.
- [x] 1.5 Create `Label`, `FormError`, `Radio` in `src/components/ui/form-controls.tsx`.
- [x] 1.6 Create strict single-panel `Accordion` in `src/components/ui/accordion.tsx`.

### Checkpoint 1

- **Verify**: `pnpm install && pnpm build` passes.
- **Expected**: Schemas compile, `Accordion` keeps one panel open.
- **Regression detection**: Build failure or multi-open accordion blocks Phase 2.

## Phase 2: Informational Modals

- [ ] 2.1 Create `src/components/ui/informational-modal.tsx` using `Modal` + `Accordion`.
- [ ] 2.2 Populate service detail content in `src/data/content.ts`.
- [ ] 2.3 Wire "Más info" buttons in `src/components/sections/static-sections.tsx` to `InformationalModal`.

### Checkpoint 2

- **Verify**: Click "Más info" on every card.
- **Expected**: Correct modal opens; strict accordion; CTA hands off to request modal.
- **Regression detection**: Placeholder modal, loose accordion, or broken handoff blocks Phase 3.

## Phase 3: Service Request Forms

- [ ] 3.1 Create `src/components/forms/service-request-modal.tsx` shell (form or success).
- [ ] 3.2 Create `src/components/forms/service-form-audit.tsx`.
- [ ] 3.3 Create `src/components/forms/service-form-landing.tsx` with conditional `brandName`.
- [ ] 3.4 Create `src/components/forms/service-form-ecommerce.tsx`.
- [ ] 3.5 Create `src/components/forms/service-form-automation.tsx`.
- [ ] 3.6 Create `src/components/forms/service-form-custom.tsx`.

### Checkpoint 3

- **Verify**: Blur and submit each form.
- **Expected**: Inline errors on blur; `brandName` required only for "Marca / empresa"; valid submit logs data and keeps modal open.
- **Regression detection**: Any form submitting invalid data blocks Phase 4.

## Phase 4: Success State & WhatsApp Integration

- [ ] 4.1 Create `src/components/forms/whatsapp-link.ts` to encode pre-filled WhatsApp URL.
- [ ] 4.2 Implement `SuccessState` inside `service-request-modal.tsx` and wire `onSubmit` transition.

### Checkpoint 4

- **Verify**: Submit a valid service form.
- **Expected**: Success state renders; WhatsApp link includes service, name, email, phone, specific fields, message; modal stays open.
- **Regression detection**: Broken link, missing fields, or auto-close blocks Phase 5.

## Phase 5: General Contact Form

- [ ] 5.1 Refactor `ContactSection` in `src/components/sections/static-sections.tsx` to `react-hook-form` + Zod.
- [ ] 5.2 Keep existing toast behavior on valid submit.

### Checkpoint 5

- **Verify**: Submit footer contact form.
- **Expected**: Invalid email or short message shows errors; valid submit shows `Toast` and resets.
- **Regression detection**: Missing toast or native validation popup blocks Phase 6.

## Phase 6: Integration & i18n

- [ ] 6.1 Split `ServicesSection` state into `infoService` and `requestService`.
- [ ] 6.2 Wire "Solicitar" buttons on cards, dark banner, and info CTA to `ServiceRequestModal`.
- [ ] 6.3 Remove `ServicePlaceholderModal`.
- [ ] 6.4 Add complete ES/EN translations for all new keys.
- [ ] 6.5 Run `pnpm build` and smoke test ES/EN.

### Checkpoint 6

- **Verify**: Click every trigger in both languages.
- **Expected**: Correct modal opens; labels switch language; no console errors; build passes.
- **Regression detection**: Wrong modal, missing translations, or build failure blocks archive.
