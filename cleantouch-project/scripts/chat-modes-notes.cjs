const fs=require('fs');fs.writeFileSync('artifacts/verification/CHAT-MODES-RELEASE.md',`# CleanTouch chatbot product and place modes

Windows 0.1.26 / Android 0.4.8.

Both chat interfaces now expose Product analysis and Place analysis. Windows product entry reuses the current scene selector and goes directly to Gemini chat without launching Lens. Selected product names and shopping queries remain identical. Android supports tap isolation and an explicit product-area selection fallback, then AI identification, shopping and conversational follow-up. Main Android chat entry no longer starts place analysis automatically.

Validation: source and packaged Windows chatbot integration tests passed, including direct product entry and no Lens launch. Android real public product AI plus manual product-area fallback and product/place switching passed on Android 16 emulator (1 test, 44.025 seconds). Galaxy A15 was not physically tested. Automatic tap segmentation did not finish within the emulator test timeout; it is not counted as passed. Fallback invalidates stale segmentation results so they cannot overwrite a newer selection. Both builds completed. Installer/APK operator-key exclusion and ARM architecture are checked at release.
`);console.log('Release notes saved');
