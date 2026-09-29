# Notes for agents working on this branch

- This branch is `claude/upbeat-edison-2k76xq`. It holds the Home Audio project in `multiroom/`. **Never merge it to `main`**, and don't open a pull request unless the user asks.
- **Read `multiroom/docs/PROJECT_CONTEXT.md` first.** It is the source of truth: the user's rules, home, devices, requirements, and every decision with its reasoning. `multiroom/docs/OPEN_ITEMS.md` is the live to-do and question list.
- `multiroom/docs/history/` holds the full conversation log (user messages word for word), research notes with sources, and the original handoff PDF.
- **When a decision, answer or fact changes, update `PROJECT_CONTEXT.md` (and `OPEN_ITEMS.md`) in the same commit.** Log new user messages in `history/CONVERSATION_LOG.md`.
- **Never commit the app password.** It lives only in Render's env var `MULTIROOM_TOKEN`.
- Run the tests with `cd multiroom && npm test`. A push to this branch auto-deploys the Render service `home-audio`.
