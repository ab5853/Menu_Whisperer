/**
 * Gemini Live API connection handler
 * Handles WebSocket connection, audio/video streaming
 */

class GeminiLive {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ws = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.audioProcessor = null;
        this.videoInterval = null;
        this.isConnected = false;
        this.onTranscript = null;
        this.onAudioResponse = null;
        this.onConnectionChange = null;

        // Audio playback queue
        this.audioQueue = [];
        this.isPlaying = false;

        // Model config
        this.model = "models/gemini-2.5-flash-native-audio-preview-12-2025";
    }

    async connect(systemPrompt) {
        return new Promise((resolve, reject) => {
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log("WebSocket connected, sending setup...");
                // Send setup message
                const setup = {
                    setup: {
                        model: this.model,
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: "Kore"
                                    }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: systemPrompt }]
                        },
                        tools: [{ googleSearch: {} }]
                    }
                };
                this.ws.send(JSON.stringify(setup));
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                // Setup complete
                if (data.setupComplete) {
                    console.log("Gemini Live session ready");
                    this.isConnected = true;
                    if (this.onConnectionChange) this.onConnectionChange(true);
                    resolve();
                    return;
                }

                // Handle server content (audio response)
                if (data.serverContent) {
                    const content = data.serverContent;

                    if (content.modelTurn && content.modelTurn.parts) {
                        for (const part of content.modelTurn.parts) {
                            // Audio response
                            if (part.inlineData && part.inlineData.mimeType.startsWith("audio/")) {
                                this.queueAudio(part.inlineData.data);
                            }
                            // Text response
                            if (part.text) {
                                if (this.onTranscript) {
                                    this.onTranscript("ai", part.text);
                                }
                            }
                        }
                    }

                    // Handle output transcription
                    if (content.outputTranscription && content.outputTranscription.text) {
                        if (this.onTranscript) {
                            this.onTranscript("ai", content.outputTranscription.text);
                        }
                    }

                    // Handle input transcription
                    if (content.inputTranscription && content.inputTranscription.text) {
                        if (this.onTranscript) {
                            this.onTranscript("user", content.inputTranscription.text);
                        }
                    }
                }
            };

            this.ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                this.isConnected = false;
                if (this.onConnectionChange) this.onConnectionChange(false);
                reject(error);
            };

            this.ws.onclose = (event) => {
                console.log("WebSocket closed:", event.code, event.reason);
                this.isConnected = false;
                if (this.onConnectionChange) this.onConnectionChange(false);
            };
        });
    }

    async startMediaStreams(videoElement) {
        try {
            // Get camera and mic
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "environment"
                }
            });

            // Show camera in video element
            videoElement.srcObject = this.mediaStream;

            // Start audio streaming
            this.startAudioCapture();

            // Start video frame streaming
            this.startVideoCapture(videoElement);

            return true;
        } catch (err) {
            console.error("Media access error:", err);
            return false;
        }
    }

    startAudioCapture() {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Use ScriptProcessor for wider compatibility
        this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.audioProcessor.onaudioprocess = (event) => {
            if (!this.isConnected || !this.ws) return;

            const inputData = event.inputBuffer.getChannelData(0);

            // Convert float32 to int16 PCM
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Convert to base64
            const base64 = this.arrayBufferToBase64(pcm16.buffer);

            // Send to Gemini
            try {
                this.ws.send(JSON.stringify({
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: "audio/pcm;rate=16000",
                            data: base64
                        }]
                    }
                }));
            } catch (e) {
                // Connection may have closed
            }
        };

        source.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioContext.destination);
    }

    startVideoCapture(videoElement) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");

        // Send a frame every 2 seconds
        this.videoInterval = setInterval(() => {
            if (!this.isConnected || !this.ws) return;

            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
            const base64 = dataUrl.split(",")[1];

            try {
                this.ws.send(JSON.stringify({
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: "image/jpeg",
                            data: base64
                        }]
                    }
                }));
            } catch (e) {
                // Connection may have closed
            }
        }, 2000);
    }

    async queueAudio(base64Data) {
        this.audioQueue.push(base64Data);
        if (!this.isPlaying) {
            this.playNextAudio();
        }
    }

    async playNextAudio() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const base64Data = this.audioQueue.shift();

        try {
            if (!this.playbackContext) {
                this.playbackContext = new AudioContext({ sampleRate: 24000 });
            }

            const rawData = atob(base64Data);
            const pcm16 = new Int16Array(rawData.length / 2);
            for (let i = 0; i < pcm16.length; i++) {
                pcm16[i] = rawData.charCodeAt(i * 2) | (rawData.charCodeAt(i * 2 + 1) << 8);
            }

            // Convert to float32
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768.0;
            }

            const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 24000);
            audioBuffer.getChannelData(0).set(float32);

            const source = this.playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.playbackContext.destination);
            source.onended = () => this.playNextAudio();
            source.start();
        } catch (e) {
            console.error("Audio playback error:", e);
            this.playNextAudio();
        }
    }

    toggleMic(muted) {
        if (this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
    }

    disconnect() {
        // Stop video capture
        if (this.videoInterval) {
            clearInterval(this.videoInterval);
            this.videoInterval = null;
        }

        // Stop audio processing
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Stop media streams
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Clear audio queue
        this.audioQueue = [];
        this.isPlaying = false;
        this.isConnected = false;
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
