# Memory Index

Your Body Intelligence memory layer. Each file captures one slice of context Claude reads to reason about your training and recovery.

- [PROFILE.md](PROFILE.md) — who you are physically, your training history, your equipment
- [PRINCIPLES.md](PRINCIPLES.md) — how you train; the decision rules Claude reasons against
- [GOALS.md](GOALS.md) — what you're training for, with race dates
- [CURRENT.md](CURRENT.md) — this week's plan and current training block
- [HEALTH_LOG.md](HEALTH_LOG.md) — narrative log of injuries, illness, niggles
- [NUTRITION.md](NUTRITION.md) — what works, what wrecks you
- [EQUIPMENT.md](EQUIPMENT.md) — gear inventory, mileage

## Daily folder

Connector sync recipes (Garmin, Whoop, Oura, etc.) write one file per day at `daily/YYYY-MM-DD.md` with vendor-specific context — Garmin training readiness, Whoop recovery score, Oura sleep score, etc. The canonical metrics (sleep hours, HRV, resting HR, workouts) still go into the structured tables via `log_daily` and `log_workout`; the daily files are for the proprietary scores and prose that don't map to columns.

The weekly review recipe reads the last seven `daily/` files when summarizing trends. Browse them with `fs_list({ prefix: "daily/" })`.

Update these whenever something changes. Claude can edit them via `fs_write`; you can edit them directly too — they round-trip cleanly.
