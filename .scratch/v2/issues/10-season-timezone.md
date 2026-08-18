# What timezone closes a Season?

Type: grilling
Status: open

## Question

A Season is a calendar month. Whose clock? Recommendation: a single named timezone stored as config (likely `Europe/Moscow` or `UTC`), not each Member's local time — otherwise Current Season disagrees between people. v1 `createdAt` must be interpreted in that same timezone when bucketing legacy Marks.
