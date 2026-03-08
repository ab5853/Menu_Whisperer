# 🍽️ Menu Whisperer

Real-time AI travel food companion. Point your camera at any foreign-language menu and get contextual guidance — not just translation, but explanations, recommendations, allergen flags, and pronunciation coaching.

Built with **Gemini Live API** (voice + vision) for the Columbia x Google Hackathon.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ab5853/Menu_Whisperer.git
cd Menu_Whisperer

# Serve locally (pick one):
npx serve .
# or
python3 -m http.server 8000
# or just open index.html in Chrome
```

Then open `http://localhost:8000` (or `http://localhost:3000` for npx serve) in **Chrome**.

> **Note:** You must use Chrome. Safari and Firefox have issues with the Live API WebSocket.

## Setup

1. Get a Gemini API key from [aistudio.google.com](https://aistudio.google.com) → Get API Key
2. Open `app.js` and replace the API key on line 7
3. Serve the files and open in Chrome
4. Click a persona → Click "Start Session" → Hold a menu up to your camera

## Features

- **Two Personas**: Ari Liu (IBS, lactose intolerant, umami lover) and Popo Batbold (no restrictions, protein everything)
- **Real-time camera**: Point at any menu in any language
- **Voice conversation**: AI talks to you naturally, no typing
- **Contextual recommendations**: Factors in dietary needs, schedule, budget
- **Pronunciation coaching**: Learn how to order in the local language
- **Google Search grounding**: Looks up real restaurant info when possible
- **Fake Google Calendar/Maps integration**: Demonstrates the connected travel companion vision

## Tech Stack

- Gemini 2.5 Flash Native Audio (Live API)
- Vanilla HTML/CSS/JS (no build step)
- WebSocket connection to Gemini Live API
- Web Audio API for mic capture and audio playback
- MediaDevices API for camera
