---
name: translator
description: 'Update Finnish and English translations when user-facing text changes. Use when translating labels, messages, workflow copy, or content and keeping locale pairs in sync in this repository.'
argument-hint: 'Describe the text or screen that changed and the target locale updates.'
---

# Translator

Use this skill when user-facing copy changes and the bilingual UI needs to stay consistent.

This repository keeps translations in two places:
- Centralized locale content in `apps/web/src/i18n.tsx`
- Inline `locale === 'fi' ? ... : ...` branches in web components such as `apps/web/src/App.tsx`, `apps/web/src/pages/WorkflowPage.tsx`, and `apps/web/src/pages/workflow/WorkflowShared.tsx`

## Goals

- Keep Finnish and English copy aligned after every content update
- Add new translation keys in both locales at the same time
- Remove or reduce new hard-coded bilingual branches when a shared translation key is a better fit
- Preserve domain terminology already used in the app

## Procedure

1. Identify the user-facing text that changed.
2. Check whether the text belongs in the shared translation map in `apps/web/src/i18n.tsx` or whether it is currently implemented as an inline locale branch.
3. If the change introduces a reusable label, message, heading, status, or section copy, add or update a translation key in the `TranslationSet` type and in both `fi` and `en` translation objects.
4. If the change touches an existing inline locale branch, update both sides of the branch. If the string is reused or likely to spread, move it into `apps/web/src/i18n.tsx` instead of adding another inline branch.
5. Search for related wording so the same concept stays consistent across the workflow. Check `apps/web/src/i18n.tsx`, `apps/web/src/App.tsx`, `apps/web/src/pages/**`, and `apps/web/src/workflowUi.ts`.
6. Keep translations complete. Never update only one locale when the text is visible to end users.
7. After editing, validate with `npm run check -w @we-build/web`. If the translation change affects rendered workflow content or labels used in tests, also run `npm run test -w @we-build/web`.

## Repo-specific guidance

- Prefer `apps/web/src/i18n.tsx` for reusable UI copy.
- Treat new direct string literals in React components as a smell unless the text is intentionally one-off.
- Do not translate `WE BUILD`. It refers to the organization name and must remain exactly `WE BUILD` in every locale.
- Preserve the established terms already present in the product, such as VAT attestation, PID, PoA, EUCC, wallet, issuer, and session.
- If a user request changes visible text outside the web app, scan the surrounding files for the corresponding locale-aware surface before finishing.

## Completion checklist

- Both `fi` and `en` are updated
- Any new key is typed in `TranslationSet`
- Any affected inline locale branch is updated or refactored into shared translations
- `npm run check -w @we-build/web` passes
- `npm run test -w @we-build/web` passes when UI text changes affect rendered output or test assertions