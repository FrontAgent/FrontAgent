# Review Checklist

Run through this checklist in order and stop where the strongest evidence appears.

## 1. Correctness

- Check whether the code does what the request claims.
- Check loading, error, empty, and success states.
- Check whether state transitions can produce stale or contradictory UI.
- Check whether conditions, loops, and async flows handle edge cases.

## 2. Build and Type Safety

- Check imports, exports, and referenced symbols.
- Check obvious TypeScript mismatches and nullable paths.
- Check whether config or dependency changes are required but missing.

## 3. UX and Accessibility

- Check focus order, keyboard access, labels, semantics, and contrast-sensitive UI choices.
- Check whether interactive controls expose disabled, loading, and error states clearly.
- Check whether text, spacing, and motion create usability regressions on small screens.

## 4. Architecture and Maintainability

- Check whether the change fits the existing layering and module boundaries.
- Check whether business logic leaked into presentation code or vice versa.
- Check whether the change introduces avoidable duplication or overly broad abstractions.

## 5. Testing and Verification

- Check whether changed behavior is covered by existing tests or obviously needs new coverage.
- Check whether the request implies manual verification steps that were skipped.

## 6. Change Risk

- Check for hidden coupling, breaking API changes, or silent behavioral drift.
- Check whether future maintenance cost increased without enough benefit.

