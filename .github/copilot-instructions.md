# Arch Trainer Project Instructions

## Product Direction

- This project is `Arch Trainer`: an educational simulator where the player installs Arch Linux through a terminal-like interface.
- Preserve the core fantasy: the player should feel like they are performing a real Arch install, not solving abstract puzzles detached from Linux concepts.
- Prefer designs and implementations that teach real commands, real failure modes, and real system reasoning.
- Default to maximum realism unless the user explicitly asks for accessibility-driven simplification.
- Keep the game readable for both learning mode and challenge mode; avoid overcomplicating the first playable version.

## Gameplay Rules

- Model the real Arch installation flow as the backbone of progression: network setup, disk partitioning, formatting, mounting, base install, system configuration, bootloader setup, reboot.
- Commands, errors, and state transitions should remain close to real Arch Linux behavior unless the user explicitly requests gamified simplification.
- Validate commands against current simulated system state. A command may be syntactically correct but still fail if prerequisites are missing.
- Prefer simulation systems that make cause and effect legible to the player: command input, parser result, validation result, state change, feedback.
- Difficulty modes should be additive: beginner explains, experienced removes assistance, expert introduces faults, god mode is unforgiving.

## Implementation Guidance

- Treat the project as a systems simulator first and a UI shell second.
- Separate concerns clearly:
  - terminal engine for parsing and dispatching commands
  - system simulator for disks, mounts, packages, filesystems, and networking
  - event engine for failures and randomized problems
  - tutorial and hint systems for beginner mode
  - scoring and timer systems for challenge modes
- Prefer data-driven command definitions and state machines over hardcoded one-off conditionals.
- Implement commands so they can produce realistic success, warning, and failure outputs.
- When possible, design simulation logic to be testable without the frontend.

## Tech Decisions

- The default implementation stack is web-based.
- Prefer a browser-first architecture with the simulation core separated from the UI so it can later support richer shells if needed.
- For frontend work, preserve a terminal-first feel and prefer interfaces that support typed command entry, system feedback, and state visualization side by side.
- If sandboxed execution or container-backed realism is proposed, treat it as an advanced mode, not a prerequisite for the MVP.

## UX and Content

- Default to a terminal-first presentation with supporting visualizations such as disk layout, mount tree, package state, and system health when useful.
- Treat Russian and English as equal first-class languages for player-facing content, tutorials, and hints where practical.
- Error feedback should teach the player what went wrong without hiding the underlying system logic.
- Keep the aesthetic minimal, technical, and deliberate. Favor a clean hacker-terminal feel over noisy sci-fi decoration.

## Accuracy and Safety

- Do not invent fake Arch commands or misleading Linux behavior when writing game content, tutorials, or simulation logic.
- If the game abstracts a real Linux concept, label the abstraction clearly in comments, docs, or tutorial text.
- Prefer canonical Arch installation concepts and terminology.

## Coding Expectations

- Keep modules small and composable.
- Prefer explicit types and predictable state transitions.
- Write tests for parser behavior, command validation, and system-state transitions.
- For Python work in this repository, use `uv` for environment and dependency management; do not use plain `pip install`.
- Do not treat the existing `env/` directory as a source of truth for project structure or dependency workflow.

## Collaboration Defaults

- When requirements are ambiguous, ask the user to choose between realism, accessibility, and implementation speed.
- When proposing features, keep them aligned with the core loop of learning or mastering Arch installation.
- Avoid adding unrelated game systems unless they directly strengthen the terminal simulator, replayability, or educational value.