# 0.1.56 — continuous voice conversation (Windows)

- The microphone button now starts an explicitly authorized, continuous Gemini Live audio session. It streams mono PCM at 16 kHz through the existing temporary-token connection; no transcription-upload/send-button loop.
- Native audio answers play automatically during voice conversation. Input/output transcripts join the current chat history; shopping tools continue to render cards in that chat.
- Server speech detection handles turn boundaries and interruption. Screen sharing remains independently authorized, and can be enabled during voice conversation.
- Closing/hiding the conversation, changing chats, device loss, connection loss, or two minutes without conversational activity releases microphone tracks. The microphone button remains usable as Stop while AI is answering.
- Ending voice discards its socket before rebuilding text/screen context, preventing late voice output from becoming a later typed answer.

Validation: desktop unit suite (114 prior tests plus the new Live transport test), real Electron AudioWorklet with a generated fake microphone source, two-turn transcript/history flow, explicit denial, reset/disconnect cleanup, existing chat/upload/history regression integration, API suite (75 tests), and packaged-source comparison.

Actual draft and production Gemini Live checks used generated Korean speech files: the first turn introduced a fictional name, the second asked for it. Both returned native audio and correct Korean transcripts; the second answer remembered the name. No ambient microphone audio was recorded in these checks.

Limits: speaker echo, background video audio, real microphone quality, and barge-in timing need hands-on device testing. Noise suppression and echo cancellation are requested but cannot guarantee separation. This release changes the Windows desktop; Android is not updated by this work.
