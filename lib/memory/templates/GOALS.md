# Goals

Your training targets. The race-countdown recipe parses race blocks below to know when to surface taper guidance — keep the format consistent or it won't fire.

## Race format convention

Each race uses this exact block:

```
## Race: <name>
- Date: YYYY-MM-DD
- Tier: A | B | C
- Distance: <e.g. 21.1 km>
- Goal: <free text — finish, sub-1:30, top 10, etc.>
- Notes: <terrain, conditions, anything Claude should know>
```

A-races are the targets that bend training around them (the recipe surfaces 14-day taper guidance for these). B-races are tune-ups. C-races are training races, run as workouts.

---

## Performance benchmarks

<!-- Current PRs/PBs you care about. Used by Claude to track whether training is heading in the right direction. -->

- 5k:
- 10k:
- Half marathon:
- Marathon:
- <!-- Add disciplines that matter to you: FTP, deadlift 1RM, swim threshold pace, etc. -->

---

## Long-term targets

<!-- 12-24 month aspirations. Why you train. -->

---

## Upcoming races

<!-- Add race blocks below this line, ordered by date. Follow the "Race format convention" at the top of this file — recipes parse it strictly. -->

<!--
Example block (kept commented so the race-countdown recipe doesn't parse it):

## Race: Example Half
- Date: 2099-01-01
- Tier: A
- Distance: 21.1 km
- Goal: sub-1:30
- Notes: example only; replace this whole block with your real race(s)
-->

