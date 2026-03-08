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

  const connect = async (systemPrompt) => {
    if (isConnected) return;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("VITE_GEMINI_API_KEY is not defined in .env");
        setMessages(prev => [...prev, { role: 'model', text: 'Error: API Key missing in .env file', isFinal: true }]);
        return;
      }

      const prompt = systemPrompt || "You are a local food and menu guide helping a traveler. Identify menu items shown on camera, translate them explicitly, and talk aloud to the user. Wait for visual input.";

      console.log('[MenuWhisperer] Connecting with API key:', apiKey.substring(0, 8) + '...');

      aiRef.current = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });
      const handleServerMessage = (message) => {
        console.log('[MenuWhisperer] Server message received:', Object.keys(message));
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

      console.log('[MenuWhisperer] Calling ai.live.connect...');
      sessionRef.current = await aiRef.current.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          systemInstruction: {
            parts: [{ text: prompt }]
          },
          responseModalities: ["AUDIO"]
        },
        callbacks: {
          onopen: () => {
            console.log('[MenuWhisperer] WebSocket OPEN');
          },
          onmessage: handleServerMessage,
          onerror: (err) => {
            console.error('[MenuWhisperer] WebSocket ERROR:', err);
          },
          onclose: (e) => {
            console.log('[MenuWhisperer] WebSocket CLOSED, code:', e?.code, 'reason:', e?.reason);
            // Only auto-disconnect if we were previously connected
            setIsConnected(prev => {
              if (prev) {
                // We were connected, now we're closing — clean up
                setIsMicOn(false);
                if (audioRecorderRef.current) {
                  audioRecorderRef.current.stop();
                  audioRecorderRef.current = null;
                }
                if (audioStreamerRef.current) {
                  audioStreamerRef.current.stop();
                  audioStreamerRef.current = null;
                }
                sessionRef.current = null;
                setMessages(msgs => [...msgs, { role: 'model', text: `Session ended (code: ${e?.code || 'unknown'}).`, isFinal: true }]);
              }
              return false;
            });
          }
        }
      });

      console.log('[MenuWhisperer] Session object:', sessionRef.current);
      console.log('[MenuWhisperer] Session methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sessionRef.current)));

      audioStreamerRef.current = new AudioStreamer();
      setIsConnected(true);

      setMessages([{ role: 'model', text: 'Connected! Point your camera at a menu and enable the mic to chat.', isFinal: true }]);

    } catch (err) {
      console.error('[MenuWhisperer] Connection FAILED:', err);
      setMessages([{ role: 'model', text: `Connection Failed: ${err.message}`, isFinal: true }]);
    }
  };

  // receiveLoop replaced by callback in connect

  const disconnect = () => {
    setIsConnected(false);
    setIsMicOn(false);
    
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
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
            sessionRef.current.sendRealtimeInput({
              audio: {
                data: base64PCM,
                mimeType: 'audio/pcm;rate=16000'
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
      sessionRef.current.sendRealtimeInput({
        media: {
          data: base64Data,
          mimeType: 'image/jpeg'
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
