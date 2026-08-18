# Where does scoring logic live?

Type: grilling
Status: open

## Question

Event types carry no numeric value — application code maps them to leaderboard buckets (karma received, humor received, karma plus given, …). Where does this mapping live, and how is it shared between the bot (writes events) and the Mini App API (reads leaderboards)? One module, duplicated, or generated?
