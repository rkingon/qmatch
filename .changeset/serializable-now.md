---
"qmatch": minor
---

Add `$now`, a serializable way to match on the current time. Its value is a query over the current wall-clock parts (`year`, `month`, `day`, `weekday`, `hour`, `minute`, `minuteOfDay`) in an IANA `$tz` (default `UTC`), so business-hours gates that previously needed a `$where` closure survive `JSON.stringify`:

```ts
match<Lead>({
  $now: {
    $tz: "America/New_York",
    $or: [
      { weekday: { $gte: 1, $lte: 5 }, minuteOfDay: { $gte: 8 * 60, $lt: 17 * 60 } },
    ],
  },
});
```

The clock is read at match time, once per call, and shared by every `$now` in the query. `match()` and `explain()` take an optional `{ now: () => Date }` to inject it. An unknown `$tz` or an invalid clock value fails the match instead of throwing. `$now` works anywhere `$where` does, including nested and inside `$and`/`$or`/`$not`/`$some`/`$every`, and failures explain under `$now.<part>`.
