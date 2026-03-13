---
description: "Generate realistic Arch install commands, failures, and teaching outputs for Arch Trainer"
name: "Generate Arch Command Pack"
argument-hint: "Describe the install phase, difficulty mode, number of commands or failures, and any special constraints"
agent: "agent"
---
Generate a new gameplay content pack for Arch Trainer.

Use the project rules from [copilot instructions](../copilot-instructions.md).

Your job is to create realistic Arch Linux installation commands and believable failure scenarios that can be used directly in the game's terminal simulator.

Requirements:
- Stay close to real Arch Linux install flow, terminology, and command behavior.
- Do not invent fake Linux commands.
- Prefer canonical Arch tools and realistic outputs.
- Keep cause and effect explicit: preconditions, player input, simulator validation, system state changes, and user-facing feedback.
- Match the requested difficulty mode.
- Treat Russian and English as equal first-class output languages when tutorial or hint text is requested.

Inputs to infer from the user request:
- Install phase or subsystem: network, partitioning, formatting, mounting, pacstrap, fstab, chroot, locale, users, bootloader, reboot, recovery, or another Arch-related step.
- Difficulty: beginner, experienced, expert, or god mode.
- Quantity: how many commands, events, or scenarios to generate.
- Special constraints: BIOS vs UEFI, Wi-Fi only, encrypted disk, LVM, broken keyring, package conflicts, NVMe disk naming, time pressure, no hints, and so on.

Output format:

## Scenario Summary
- Phase:
- Difficulty:
- Learning goal:
- Realism notes:

## Command Pack
For each command, provide:
1. Player command
2. Preconditions in simulator state
3. Validation rules
4. Success output
5. Failure outputs
6. State changes
7. Beginner explanation in Russian
8. Beginner explanation in English

## Failure Events
For each event, provide:
1. Event name
2. Trigger conditions
3. What the player sees
4. Correct diagnosis
5. Correct recovery commands
6. Wrong but plausible player actions
7. Why those wrong actions fail
8. Difficulty-specific tuning

## Implementation Notes
- Suggest parser tokens or argument patterns that the simulator should recognize.
- Suggest state flags or data fields needed in the system simulator.
- Flag anything that is intentionally simplified versus real Arch behavior.

If the user request is broad, generate 3 to 5 tightly scoped scenarios instead of one huge list.
If the user request is ambiguous, choose the most likely Arch installation phase and state your assumption clearly.