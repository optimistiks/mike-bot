# Attribute scoring to message-based monthly Seasons

A v2 Event is credited to the calendar-month Season in `Europe/Moscow` in which its message was posted, but only when Telegram's action timestamp falls before ten minutes after that Season ends; later reaction changes produce no Event and cannot alter that Season. The grace period absorbs boundary timing, and Telegram timestamps rather than webhook processing time determine eligibility. Imported v1 Events lack message timestamps, so their action timestamps also serve as their message timestamps.
