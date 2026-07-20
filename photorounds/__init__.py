"""PhotoRounds — local, offline photo & video consolidation in immutable rounds.

Ingest media from SD cards, folders, and Google Takeout into a date-organized
tree, then run separate rounds for duplicate removal, format conversion, and
print resizing. Every round writes a brand-new folder; earlier rounds are
never modified. No network access, no cloud, no AI — everything runs on the
local machine.
"""

__version__ = "1.0.0"
APP_NAME = "PhotoRounds"
