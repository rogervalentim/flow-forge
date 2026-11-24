---
name: Feature request
about: Propose a new capability, component or workflow for FlowForge UI
title: "feat: "
labels: ["type: feature", "status: triage"]
assignees: []
---

## Summary

<!-- One paragraph. What should exist that does not exist today? -->

## Motivation

<!-- Which user, which workflow, what pain. Link evidence (thread, run ID, screenshot). -->

## Proposed design

<!--
UI is Swiss Industrial / Precision Tooling: flat dark surfaces, 1px structural
borders, 6px radius, monospace telemetry. Purple/neon gradients, glassmorphism,
large drop shadows and oversized radii are rejected in review.
-->

- Surface(s) affected:
- New component in the design system? (`src/design-system/components/<Name>`)
- Tokens needed? (must be added to `src/design-system/tokens.css` first)
- Accessibility notes (roles, focus order, keyboard path):

## Acceptance criteria

- [ ] Component exported from `src/design-system/index.ts`
- [ ] Story with `play` interaction test covering the primary path
- [ ] Keyboard + focus-visible behaviour verified
- [ ] `npm run typecheck` and `npm run test:all` pass
- [ ] No hardcoded colour/radius values — tokens only

## Out of scope

<!-- What this ticket deliberately does not cover. -->

## Risks / open questions

<!--
Does it change an existing token? Break a consumer? Need a new dependency
(every new runtime dependency must justify its weight)?
-->
