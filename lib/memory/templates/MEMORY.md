# Memory Index

Your Body Intelligence memory layer. Each file captures one slice of context Claude reads to reason about your training and recovery.

- [PROFILE.md](PROFILE.md) — who you are physically, your training history, your equipment
- [PRINCIPLES.md](PRINCIPLES.md) — how you train; the decision rules Claude reasons against
- [GOALS.md](GOALS.md) — what you're training for, with race dates
- [CURRENT.md](CURRENT.md) — this week's plan and current training block
- [HEALTH_LOG.md](HEALTH_LOG.md) — narrative log of injuries, illness, niggles
- [NUTRITION.md](NUTRITION.md) — what works, what wrecks you
- [EQUIPMENT.md](EQUIPMENT.md) — gear inventory, mileage

Update these whenever something changes. Claude can edit them via `fs_write`; you can edit them directly too — they round-trip cleanly.
