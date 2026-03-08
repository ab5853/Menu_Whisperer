/**
 * Menu Whisperer — Main App
 */

// ============================================
// PUT YOUR API KEY HERE
const API_KEY = "AIzaSyB3weoLKAJabwCT697a7AS5o34Yjdvv4w0";
// ============================================

let gemini = null;
let activePersona = "ari";
let sessionActive = false;
let micMuted = false;

// DOM Elements
const btnAri = document.getElementById("btn-ari");
const btnPopo = document.getElementById("btn-popo");
const personaCardAri = document.getElementById("persona-card-ari");
const personaCardPopo = document.getElementById("persona-card-popo");
const personaCard = document.getElementById("persona-card");
const cameraContainer = document.getElementById("camera-container");
const cameraFeed = document.getElementById("camera-feed");
const cameraOverlay = document.getElementById("camera-overlay");
const cameraLabel = document.getElementById("camera-label");
const transcript = document.getElementById("transcript");
const sessionBtn = document.getElementById("session-btn");
const micBtn = document.getElementById("mic-btn");
const cameraBtnToggle = document.getElementById("camera-toggle-btn");

// ---- Persona Switching ----

function switchPersona(persona) {
    activePersona = persona;

    // Update buttons
    btnAri.classList.toggle("active", persona === "ari");
    btnPopo.classList.toggle("active", persona === "popo");

    // Update persona card
    personaCardAri.classList.toggle("hidden", persona !== "ari");
    personaCardPopo.classList.toggle("hidden", persona !== "popo");

    // Update camera border
    cameraContainer.classList.remove("ari-active", "popo-active");
    cameraContainer.classList.add(persona === "ari" ? "ari-active" : "popo-active");

    // Update session button color
    if (!sessionActive) {
        const color = persona === "ari" ? "var(--blue)" : "var(--red)";
        sessionBtn.style.background = color;
        sessionBtn.style.borderColor = color;
    }

    // If session is active, restart with new persona
    if (sessionActive) {
        addTranscriptMsg("system", `Switching to ${PERSONAS[persona].name}...`);
        restartSession();
    }
}

btnAri.addEventListener("click", () => switchPersona("ari"));
btnPopo.addEventListener("click", () => switchPersona("popo"));

// ---- Session Management ----

async function startSession() {
    if (sessionActive) {
        stopSession();
        return;
    }

    sessionBtn.querySelector(".session-label").textContent = "Connecting...";
    sessionBtn.querySelector(".session-icon").textContent = "hourglass_top";
    sessionBtn.disabled = true;

    try {
        gemini = new GeminiLive(API_KEY);

        // Set up transcript callbacks
        gemini.onTranscript = (role, text) => {
            const msgClass = role === "user" ? "user" : "ai";
            addTranscriptMsg(msgClass, text);
        };

        gemini.onConnectionChange = (connected) => {
            if (!connected && sessionActive) {
                addTranscriptMsg("system", "Connection lost. Click Start Session to reconnect.");
                stopSession();
            }
        };

        // Connect with active persona's system prompt
        const persona = PERSONAS[activePersona];
        await gemini.connect(persona.systemPrompt);

        // Start camera and mic
        const mediaStarted = await gemini.startMediaStreams(cameraFeed);
        if (!mediaStarted) {
            addTranscriptMsg("system", "Could not access camera/mic. Check browser permissions.");
            gemini.disconnect();
            resetSessionBtn();
            return;
        }

        // Update UI
        sessionActive = true;
        cameraOverlay.classList.add("hidden");
        cameraLabel.classList.add("visible");
        sessionBtn.querySelector(".session-label").textContent = "End Session";
        sessionBtn.querySelector(".session-icon").textContent = "stop";
        sessionBtn.classList.add("active");
        sessionBtn.disabled = false;
        micBtn.disabled = false;
        cameraBtnToggle.disabled = false;

        addTranscriptMsg("system", `Connected as ${persona.name}. Hold up a menu and start talking!`);

    } catch (err) {
        console.error("Session start error:", err);
        addTranscriptMsg("system", "Failed to connect. Check your API key and try again. Error: " + err.message);
        resetSessionBtn();
    }
}

function resetSessionBtn() {
    const color = activePersona === "ari" ? "var(--blue)" : "var(--red)";
    sessionBtn.querySelector(".session-label").textContent = "Start Session";
    sessionBtn.querySelector(".session-icon").textContent = "play_arrow";
    sessionBtn.style.background = color;
    sessionBtn.style.borderColor = color;
    sessionBtn.classList.remove("active");
    sessionBtn.disabled = false;
}

function stopSession() {
    if (gemini) {
        gemini.disconnect();
        gemini = null;
    }

    sessionActive = false;
    cameraOverlay.classList.remove("hidden");
    cameraLabel.classList.remove("visible");
    cameraFeed.srcObject = null;

    resetSessionBtn();
    micBtn.disabled = true;
    cameraBtnToggle.disabled = true;
    micMuted = false;
    micBtn.classList.remove("muted");
    micBtn.querySelector(".mic-label").textContent = "Mute";
    micBtn.querySelector(".material-icons-round").textContent = "mic";
}

async function restartSession() {
    stopSession();
    await new Promise(r => setTimeout(r, 500));
    startSession();
}

sessionBtn.addEventListener("click", startSession);

// ---- Mic Toggle ----

micBtn.addEventListener("click", () => {
    micMuted = !micMuted;
    if (gemini) {
        gemini.toggleMic(micMuted);
    }
    micBtn.classList.toggle("muted", micMuted);
    micBtn.querySelector(".mic-label").textContent = micMuted ? "Unmute" : "Mute";
    micBtn.querySelector(".material-icons-round").textContent = micMuted ? "mic_off" : "mic";
});

// ---- Camera Toggle ----

cameraBtnToggle.addEventListener("click", () => {
    if (gemini && gemini.mediaStream) {
        const videoTrack = gemini.mediaStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            cameraBtnToggle.querySelector(".camera-label-text").textContent = videoTrack.enabled ? "Camera" : "Camera Off";
            cameraBtnToggle.querySelector(".material-icons-round").textContent = videoTrack.enabled ? "videocam" : "videocam_off";
        }
    }
});

// ---- Transcript ----

function addTranscriptMsg(type, text) {
    if (!text || text.trim() === "") return;

    const msg = document.createElement("div");

    if (type === "user") {
        msg.className = "transcript-msg user-msg";
    } else if (type === "ai") {
        msg.className = `transcript-msg ai-msg ${activePersona}-msg`;
    } else {
        msg.className = "transcript-msg system-msg";
    }

    msg.textContent = text;
    transcript.appendChild(msg);
    transcript.scrollTop = transcript.scrollHeight;

    // Keep transcript manageable
    while (transcript.children.length > 50) {
        transcript.removeChild(transcript.firstChild);
    }
}

// ---- Init ----
switchPersona("ari");
