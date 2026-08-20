# Store scoring as typed append-only Events

Each addition or removal of an eligible Scoring reaction appends a typed Event; removals compensate with undo Events rather than updating or deleting history. Application code owns the scoring effect of each Event type, allowing Karma plus, Karma minus, and Humor Marks to remain independent while v1 history occupies the same log with stable import deduplication. This preserves an auditable history at the cost of compensating Events and explicit eligibility rules for closed Seasons.
