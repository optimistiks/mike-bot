# What timezone closes a Season?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: grilling
Status: resolved

## Question

A Season is a calendar month. Whose clock? Recommendation: a single named timezone stored as config (likely `Europe/Moscow` or `UTC`), not each Member's local time — otherwise Current Season disagrees between people. v1 `createdAt` must be interpreted in that same timezone when bucketing legacy Marks.

## Answer

`Europe/Moscow` for Season boundaries and Current Season. v1-imported events use preserved `created_at` bucketed in the same timezone.
