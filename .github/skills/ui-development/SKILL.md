---
name: ui-development
description: 'Build or update the web UI using component-based patterns. Use when creating layouts, adding screens, refining look-and-feel consistency, reusing generic components, or extracting shared UI primitives in this repository.'
argument-hint: 'Describe the page, layout, or UI change you want to make.'
---

# UI Development

Use this skill when working on the web UI so page structure, layout primitives, and styling stay consistent across screens.

This repository already has shared UI surfaces that should be the default starting point:
- `apps/web/src/components/AppShell.tsx` for the overall app chrome, header, navigation, and footer
- `apps/web/src/components/PageLayout.tsx` for common page hero and section structure
- `apps/web/src/pages/**` for page composition that should stay thin and focused on content

## Goals

- Keep the UI component-based instead of building page layouts from repeated raw markup
- Prefer existing generic components before adding page-specific layout wrappers
- When existing primitives are not enough, extract or create new reusable components instead of duplicating layout patterns across pages
- Preserve a consistent look-and-feel across pages by routing structure and styling through shared components
- Keep page files focused on content, data wiring, and page-specific behavior

## Procedure

1. Start from the closest existing UI primitive before writing new markup. Check `apps/web/src/components/AppShell.tsx`, `apps/web/src/components/PageLayout.tsx`, and the relevant page files in `apps/web/src/pages/**`.
2. If the change is mostly structural or visual and the same pattern could appear on more than one screen, implement it in a generic component instead of a single page.
3. When a page needs a new layout pattern, create a reusable component in `apps/web/src/components/**` or expand an existing shared component rather than embedding the full layout directly in the page.
4. Keep shared components generic in naming and props. Avoid creating components that are accidentally locked to one screen when the layout pattern is reusable.
5. Reuse existing class names and styling conventions when they already express the intended pattern. If new styles are needed, add them in a way that supports reuse across screens rather than one-off page styling.
6. Keep navigation within the existing single-page application shell. Do not introduce router-based or URL-backed navigation unless explicitly requested.
7. If the UI change introduces or changes user-facing copy, also use the translator skill so Finnish and English stay aligned.
8. After editing, validate with `npm run check -w @we-build/web`. If the UI change affects rendered behavior, component composition, or page output, also run `npm run test -w @we-build/web`.

## Repo-specific guidance

- Treat repeated page sections, panels, headers, action rows, and other layout structures as extraction candidates.
- Prefer extending `PageHero` and `PageSection` patterns before inventing a separate page frame.
- Keep `AppShell` as the source of truth for app-level framing so pages feel like parts of one product.
- Avoid large page components that mix layout scaffolding, copy, and interaction logic in one file.
- When adding a new reusable component, make its props support composition instead of hard-coding page-specific text or structure.

## Completion checklist

- Layout work uses an existing shared component or introduces a reusable new one
- Page files remain focused and do not absorb repeated structural markup
- Styling changes support consistent look-and-feel across screens
- `npm run check -w @we-build/web` passes
- `npm run test -w @we-build/web` passes when UI behavior or rendering is affected