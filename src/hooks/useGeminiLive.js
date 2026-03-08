import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AudioRecorder, AudioStreamer } from '../utils/audio';

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isMicOn, setIsMicOn] = useState(false);
  
  const aiRef = useRef(null);
  const sessionRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioStreamerRef = useRef(null);

  // Buffer text chunks before final emit
  const streamingTextRef = useRef('');

  const connect = async () => {
    if (isConnected) return;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("VITE_GEMINI_API_KEY is not defined in .env");
        setMessages(prev => [...prev, { role: 'model', text: 'Error: API Key missing in .env file', isFinal: true }]);
        return;
      }

      aiRef.current = new GoogleGenAI({ apiKey });
      const handleServerMessage = (message) => {
        const serverContent = message.serverContent;
        if (!serverContent) return;

        if (serverContent.modelTurn) {
          const parts = serverContent.modelTurn.parts;
          let textChunk = '';

          for (const part of parts) {
            if (part.text) {
              textChunk += part.text;
            }
            if (part.inlineData && part.inlineData.data) {
              if (audioStreamerRef.current) {
                audioStreamerRef.current.addPCM16(part.inlineData.data);
              }
            }
          }

          if (textChunk) {
            streamingTextRef.current += textChunk;
            
            setMessages(prev => {
              const newMsgs = [...prev];
              const lastMsg = newMsgs[newMsgs.length - 1];
              
              if (lastMsg && lastMsg.role === 'model' && !lastMsg.isFinal) {
                lastMsg.text = streamingTextRef.current;
              } else {
                newMsgs.push({ role: 'model', text: streamingTextRef.current, isFinal: false });
              }
              return newMsgs;
            });
          }
        }
        
        if (serverContent.turnComplete) {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg && lastMsg.role === 'model') {
              lastMsg.isFinal = true;
            }
            return newMsgs;
          });
          streamingTextRef.current = '';
        }
      };

      sessionRef.current = await aiRef.current.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          systemInstruction: {
            parts: [{ text: "You are a local food and menu guide helping a traveler. Identify menu items shown on camera, translate them explicitly, and talk aloud to the user. Wait for visual input." }]
          },
          responseModalities: ["AUDIO"]
        },
        callbacks: {
          onmessage: handleServerMessage,
          onerror: (err) => {
            console.error("Live session stream error:", err);
            disconnect();
          },
          onclose: () => {
            console.log("Live session closed.");
            disconnect();
          }
        }
      });

      audioStreamerRef.current = new AudioStreamer();
      setIsConnected(true);

      setMessages([{ role: 'model', text: 'Connected successfully. Listening...', isFinal: true }]);

    } catch (err) {
      console.error("Failed to connect to Gemini Live:", err);
      setMessages([{ role: 'model', text: `Connection Failed: ${err.message}`, isFinal: true }]);
    }
  };

  // receiveLoop replaced by callback in connect

  const disconnect = () => {
    setIsConnected(false);
    setIsMicOn(false);
    
    if (sessionRef.current) {
      try {
        // Many WebSocket implementations have a close or socket cleanup on the backend.
        // We'll reset reference so it falls out of scope.
        // @google/genai session does not have close() explicitly documented, wait for cleanup
      } catch (e) {} 
      sessionRef.current = null;
    }
    
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
      audioStreamerRef.current = null;
    }
    
    setMessages(prev => [...prev, { role: 'model', text: 'Disconnected.', isFinal: true }]);
  };

  const toggleMic = () => {
    if (!isConnected) return;
    
    if (isMicOn) {
      audioRecorderRef.current?.stop();
      audioRecorderRef.current = null;
      setIsMicOn(false);
    } else {
      audioRecorderRef.current = new AudioRecorder((base64PCM) => {
        if (sessionRef.current) {
          try {
            sessionRef.current.send({
              realtimeInput: {
                mediaChunks: [
                  { mimeType: 'audio/pcm;rate=16000', data: base64PCM }
                ]
              }
            });
          } catch (e) {
            console.error("Error streaming audio via send:", e);
          }
        }
      });
      audioRecorderRef.current.start();
      setIsMicOn(true);
    }
  };

  const sendImage = useCallback((base64JPEG) => {
    if (!isConnected || !sessionRef.current) return;

    // Strip out the data URL prefix if formatted like: data:image/jpeg;base64,...
    const base64Data = typeof base64JPEG === 'string' && base64JPEG.includes(',') 
      ? base64JPEG.split(',')[1] 
      : base64JPEG;
      
    try {
      sessionRef.current.send({
        realtimeInput: {
          mediaChunks: [
            { mimeType: 'image/jpeg', data: base64Data }
          ]
        }
      });
    } catch (e) {
      console.error("Error sending camera frame to live session:", e);
    }
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    messages,
    isMicOn,
    connect,
    disconnect,
    toggleMic,
    sendImage
  };
}
