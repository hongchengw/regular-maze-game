# Agent Instructions

Working agreement for anyone, human or agent, touching this repo.

## SPEC.md is the source of truth

`SPEC.md` describes every behavior of the app. Any behavior change lands in the spec
first, then in code. If code and spec disagree, the spec wins and the code is a bug.
Never change behavior to match code that drifted.

## Failing tests before features

Every feature gets a failing test before its implementation:

1. Write the test from the spec.
2. Run it. Confirm it fails, and that it fails for the reason you expect.
3. Implement until it passes.

The red run is not a ritual. It is the evidence that you understood the core functionality of the
task before writing any of it. If you cannot write a test that fails for the right reason, you do
not yet understand the behavior well enough to implement it, and going straight to the
implementation hides that gap instead of closing it.

What that means in practice:

- Derive the test from `SPEC.md`, not from the implementation you are about to write. A test written
  against code you already wrote only proves the code does what it does.
- **The failure must be behavioral, not incidental.** A test that fails only because the module does
  not exist yet has proved nothing. Once the module exists with stub exports, the test must still
  fail on its assertion. Name the failure you expect before you run, then check the real failure
  matches it.
- Cover each task's core functionality with at least one test that would still fail against a
  plausible wrong implementation, not merely against an empty one. The anti-tunneling case in
  `tasks/task-03-collision.md` is the model: a point-only collision check passes every other test in
  that task and fails only that one.
- A task is complete only when its tests pass. Passing tests are the definition of done, not
  paperwork filed afterwards.

## Before every commit

```
npm test
node build/build.js
```

Both must succeed. `dist/index.html` is a committed artifact, so rebuild it whenever
`src/` changes and commit the result alongside the source.

## Commits

- One commit per task in `tasks/`.
- Conventional Commits format, for example `feat(build): add dependency-free bundler`.
- Write every commit message with the `git-commit-formatter` skill. It owns the format, so do not
  hand-roll a message and hope it conforms.
- **Never add a `Co-Authored-By` trailer, and never list Claude as a co-author on any commit.**
- Append a `changelogs/CHANGELOGS.md` entry per task, newest first, with the real
  current time in EDT.

## Style

- Prioritize simplicity and readability over clever solutions.
- Start minimal, verify it works, then add complexity.
- Prefer functional and stateless code where it improves clarity.
- Keep core logic clean and push implementation details to the edges.
- Keep indentation, naming, and patterns consistent across the codebase.
- No em-dashes in prose.