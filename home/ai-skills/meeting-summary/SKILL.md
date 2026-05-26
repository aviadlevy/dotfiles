---
name: meeting-summary
description: Transcribe an audio recording using mlx-stt, then summarize the meeting with action items and offer to send via Slack.
version: 1.0.0
author: aviadlevy
triggers:
- "/meeting-summary"
- "summarize meeting ..."
- "summarize this meeting ..."
- "meeting summary ..."
- "transcribe and summarize ..."
---

# Meeting Summary

Transcribe a meeting recording using mlx-stt (local, Apple Silicon), then produce a structured summary with action items.

## Steps

### 1. Locate the Audio File

If the user provided a file path, use it directly. Otherwise, help locate the file:
- Check `~/Downloads` for recent audio files (`.m4a`, `.mp3`, `.wav`, `.webm`, `.ogg`)
- If multiple files match, list them and ask the user to pick one

### 2. Transcribe with mlx-stt

Run the mlx-stt skill to transcribe the audio. The model auto-detects the language.

```bash
bash /Users/aviadlevy/.claude/skills/mlx-stt/install.sh
```

```bash
bash /Users/aviadlevy/.claude/skills/mlx-stt/mlx-stt.sh <audio_file_path>
```

### 3. Produce the Meeting Summary

Analyze the transcript and produce a structured summary with these sections:

**Meeting Title** — infer from content. Use a concise, descriptive title.

**Date & Participants** — infer from the transcript. If participants can't be identified, state "Participants could not be identified from the recording."

**Summary** — key discussion points as concise bullets. Group by topic if the meeting covered multiple subjects.

**Action Items** — a table with columns: #, Owner, Action, Timeline.
- Extract concrete action items with owners and timelines when mentioned.
- If NO action items can be identified, explicitly state: "No action items identified in this meeting."

### 4. Present to User

Show the full summary to the user in the terminal.

### 5. Offer Slack Delivery

After presenting the summary, ask:

> "Want me to send this via Slack? If so, which channel or person?"

If the user wants to send via Slack:
- Format the message for Slack: use `**bold**` for emphasis (NOT `*italic*` — single asterisks don't work as expected in Slack)
- Use `_underline_` sparingly if needed
- Keep the message concise and readable

**Tagging participants and action item owners:**
- For each person mentioned in the summary or action items, search for them in Slack using `slack_search_users` by their name
- If a match is found, present the list of matched users to the user and ask them to confirm which ones are correct before tagging
- Only after the user confirms, use `<@USER_ID>` format to tag them in the Slack message (in the participants line and next to their name in action items)
- If no match is found for a name, leave the plain text name without a tag

- Send using the Slack MCP tools
- Return the message link to the user
