# Attribute scoring to message-based monthly Seasons

A live Event is credited to the calendar-month Season in `Europe/Moscow` in which its Message was posted, but only when Telegram's timestamp for the Scoring action falls before ten minutes after that Season ends; a later reaction, removal, or reply produces no Event and cannot alter that Season. The grace period absorbs boundary timing, and Telegram timestamps rather than webhook processing time determine eligibility. Imported v1 Events retain their own historical timestamps for Season attribution. Their associated Message date is only a best-effort, second-precision estimate from the earliest v1 Event for that Message and does not move historical totals.

An annual Leaderboard aggregates the Events already admitted to its twelve Seasons. It does not apply a second annual cutoff or reassign Events, so monthly totals always sum to the corresponding annual total; annual Crown and Chicken flair is recomputed from those totals.
