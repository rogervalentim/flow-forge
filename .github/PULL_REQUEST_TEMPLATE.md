<!--
PR title must follow Conventional Commits: feat|fix|chore|refactor|docs|test|perf(scope): subject
-->

## What changed

<!-- One paragraph. The reviewer should understand the diff before opening it. -->

## Why

<!-- Link the issue: Closes #123. State the user-facing problem. -->

## Design system impact

- [ ] No visual change
- [ ] Tokens changed (`src/design-system/tokens.css`) — list them below
- [ ] Component API changed — list breaking props below
- [ ] New component / story added

<details>
<summary>Tokens or API changes</summary>

```diff
```

</details>

## Screenshots

<!--
Required for any visual change: light the component on the dot-grid canvas,
one image before / one after. GIF for interaction changes.
-->

| Before | After |
| ------ | ----- |
|        |       |

## Verification

- [ ] `npm run typecheck` passes (strict, `noUncheckedIndexedAccess`)
- [ ] `npm run test` passes
- [ ] `npm run test:stories` passes (Storybook `play` interactions)
- [ ] `npm run build` and `npm run build-storybook` pass
- [ ] Keyboard path and focus-visible state checked
- [ ] `docker compose --profile prod up --build` serves the change

## Checklist

- [ ] Conventional Commit title
- [ ] No hardcoded colours, radii or shadows — design tokens only
- [ ] No new runtime dependency without a note in the description
- [ ] Docs / stories updated for any public prop
