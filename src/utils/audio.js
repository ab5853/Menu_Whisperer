// src/utils/audio.js

export class AudioRecorder {
  constructor(onAudioReady) {
    this.onAudioReady = onAudioReady;
    this.audioContext = null;
    this.stream = null;
    this.processor = null;
    this.source = null;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Gemini Live prefers 16000Hz PCM
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // We use ScriptProcessorNode for wide compatibility and easy inline processing
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        // Convert Float32 to Int16
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Fast float to Base64 PCM via string
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        
        const base64 = btoa(binary);
        if (this.onAudioReady) {
          this.onAudioReady(base64);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err) {
      console.error("Failed to start audio recorder:", err);
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export class AudioStreamer {
  constructor() {
    // Gemini output audio is PCM 24000Hz
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    this.startTime = 0;
  }

  addPCM16(base64Data) {
    if (!this.audioContext) return;
    
    // Ensure we are playing if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Decode Base64 to ArrayBuffer -> Int16 -> Float32
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Buffer contains Int16 data
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    // Convert Int16 into Float32 web audio range [-1.0, 1.0]
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create an audio buffer for playback
    const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Schedule the chunk seamlessly
    const currentTime = this.audioContext.currentTime;
    if (this.startTime < currentTime) {
        this.startTime = currentTime; // Buffer underrun or initial start
    }
    
    source.start(this.startTime);
    this.startTime += audioBuffer.duration;
  }

  stop() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.startTime = 0;
  }
}
