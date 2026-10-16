# 0.1.57 — reliable conversation connections

- Reuse a healthy Gemini Live session when the microphone is stopped and restarted. Suppress the previous voice turn while it finishes before allowing another question; discard a stuck turn after a bounded timeout.
- Share concurrent connection attempts, honor short server cooldowns with a cancellable internal retry, and postpone planned session renewal during active voice conversation.
- Prioritize interactive AI connections over title generation. Title repair handles one batch at a time with a pacing delay instead of opening connections for the whole backlog.
- Distinguish connection congestion from the daily connection budget. The relay's burst limit is configurable (default 8 per minute per IP); the existing daily budget remains 30. These are instance-local controls, not durable global quota enforcement.
- Remove Electron IPC wrapper text from connection errors. Voice UI distinguishes connecting, listening, preparing an answer, and speaking.

Verification: 119 desktop unit tests, 76 API tests, Electron microphone lifecycle integration, and chat/upload/history integration passed. An actual draft relay check used the desktop's Live transport with generated Korean speech: stop and restart voice between two questions, one token request total, native audio replies, and the second answer remembered the fictional name from the first question. No ambient microphone audio was captured.

Remaining release validation: real microphones, speaker echo, background video audio, device-specific interruptions, long sessions and network loss. These changes improve connection reliability; they do not establish parity with every feature or model capability of other AI apps. Android is unchanged.
