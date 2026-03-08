import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square, MessageSquare, User } from 'lucide-react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { PERSONAS } from './data/personas';

function App() {
  const [stream, setStream] = useState(null);
  const [activePersona, setActivePersona] = useState(PERSONAS[0]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  const { isConnected, messages, isMicOn, connect, disconnect, toggleMic, sendImage } = useGeminiLive();

  // Handle webcam video mounting
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle auto-scroll down for the transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Stream video frames to Gemini via canvas capture loop
  useEffect(() => {
    let intervalId;
    if (isConnected && stream && videoRef.current) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
      }
      
      const ctx = canvasRef.current.getContext('2d');
      intervalId = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
          const base64JPEG = canvasRef.current.toDataURL('image/jpeg', 0.8);
          sendImage(base64JPEG);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isConnected, stream, sendImage]);

  const toggleWebcam = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    } else {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(mediaStream);
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    }
  };

  const switchPersona = async (persona) => {
    if (persona.id === activePersona.id) return;
    setActivePersona(persona);
    if (isConnected) {
      disconnect();
      // Small delay to let WebSocket close cleanly before reconnecting
      await new Promise(r => setTimeout(r, 500));
      connect(persona.systemPrompt);
    }
  };

  const handleConnect = () => {
    connect(activePersona.systemPrompt);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Dynamic accent color based on persona
  const accentColor = activePersona.id === 'ari' ? 'ari' : 'popo';

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 flex flex-col md:flex-row font-sans">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Banner with Persona Switcher */}
        <header className="p-4 md:p-5 border-b border-gray-800 bg-black/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Title */}
            <div className="shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-saffron to-saffron-dark bg-clip-text text-transparent">
                Menu Whisperer
              </h1>
              <p className="text-gray-500 italic text-xs mt-0.5">Your AI local friend, anywhere in the world</p>
            </div>

            {/* Persona Switcher */}
            <div className="flex-1 flex flex-col gap-2 sm:items-end">
              <div className="flex gap-2">
                {PERSONAS.map((persona) => {
                  const isActive = persona.id === activePersona.id;
                  const colorClasses = persona.id === 'ari'
                    ? isActive 
                      ? 'bg-ari text-white shadow-lg shadow-ari/25 border-ari' 
                      : 'bg-transparent text-gray-400 border-gray-700 hover:border-ari/50 hover:text-ari'
                    : isActive
                      ? 'bg-popo text-white shadow-lg shadow-popo/25 border-popo'
                      : 'bg-transparent text-gray-400 border-gray-700 hover:border-popo/50 hover:text-popo';

                  return (
                    <button
                      key={persona.id}
                      onClick={() => switchPersona(persona)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-200 active:scale-95 ${colorClasses}`}
                    >
                      <User className="w-3.5 h-3.5" />
                      {persona.name}
                    </button>
                  );
                })}
              </div>
              
              {/* Bio Card */}
              <div className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                activePersona.id === 'ari' 
                  ? 'bg-ari/5 border-ari/20 text-ari' 
                  : 'bg-popo/5 border-popo/20 text-popo'
              }`}>
                {activePersona.bio}
              </div>
            </div>
          </div>
        </header>

        {/* Center - Camera Placeholder */}
        <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center relative bg-black/40 min-h-[40vh]">
          <div className="w-full h-full max-w-4xl bg-black rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center shadow-2xl overflow-hidden relative group">
            {stream ? (
              <>
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-800 z-20">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-xs font-semibold text-white tracking-widest uppercase">Live</span>
                </div>
              </>
            ) : (
              <>
                <Camera className="w-16 h-16 text-gray-600 mb-4 group-hover:text-saffron transition-colors" />
                <p className="text-gray-500 font-medium tracking-wide pb-4">Camera Feed Offline</p>
              </>
            )}
            
            {/* Viewfinder Decorative Elements */}
            <div className={`absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 opacity-50 pointer-events-none z-10 transition-colors duration-300 ${activePersona.id === 'ari' ? 'border-ari' : 'border-popo'}`}></div>
            <div className={`absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 opacity-50 pointer-events-none z-10 transition-colors duration-300 ${activePersona.id === 'ari' ? 'border-ari' : 'border-popo'}`}></div>
            <div className={`absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 opacity-50 pointer-events-none z-10 transition-colors duration-300 ${activePersona.id === 'ari' ? 'border-ari' : 'border-popo'}`}></div>
            <div className={`absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 opacity-50 pointer-events-none z-10 transition-colors duration-300 ${activePersona.id === 'ari' ? 'border-ari' : 'border-popo'}`}></div>
          </div>
        </main>

        {/* Bottom Controls */}
        <footer className="p-4 md:p-6 bg-black/20 border-t border-gray-800 backdrop-blur-md shrink-0">
          <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-3 sm:gap-4">
            
            {!isConnected ? (
              <button onClick={handleConnect} className={`flex items-center gap-2 px-5 py-3 sm:px-8 sm:py-4 font-bold rounded-full transition-all shadow-lg active:scale-95 ${
                activePersona.id === 'ari' 
                  ? 'bg-ari hover:bg-ari-dark text-white shadow-ari/20' 
                  : 'bg-popo hover:bg-popo-dark text-white shadow-popo/20'
              }`}>
                <Play className="w-5 h-5" fill="currentColor" />
                Start Session
              </button>
            ) : (
              <button onClick={disconnect} className="flex items-center gap-2 px-5 py-3 sm:px-8 sm:py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full transition-all shadow-lg shadow-red-500/20 active:scale-95">
                <Square className="w-5 h-5" fill="currentColor" />
                Stop Session
              </button>
            )}
            <button 
              onClick={toggleWebcam}
              className="flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-4 bg-panel-bg hover:bg-gray-800 border border-gray-700 text-white font-medium rounded-full transition-all active:scale-95 shadow-lg"
            >
              {stream ? <VideoOff className="w-5 h-5 text-gray-400" /> : <Video className="w-5 h-5 text-gray-400" />}
              <span className="hidden sm:inline">{stream ? 'Webcam Off' : 'Webcam On'}</span>
              <span className="sm:hidden">{stream ? 'Off' : 'Cam'}</span>
            </button>
            
            <button 
              onClick={toggleMic}
              disabled={!isConnected}
              className={`flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-4 border text-white font-medium rounded-full transition-all shadow-lg
                ${!isConnected ? 'opacity-50 cursor-not-allowed bg-black/40 border-gray-800 text-gray-500' 
                  : isMicOn 
                    ? (activePersona.id === 'ari' ? 'bg-ari text-white border-ari shadow-ari/20' : 'bg-popo text-white border-popo shadow-popo/20')
                    : 'bg-panel-bg hover:bg-gray-800 border-gray-700 active:scale-95'}
              `}>
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-gray-400" />}
              <span className="hidden sm:inline">{isMicOn ? 'Mic On' : 'Mic Off'}</span>
              <span className="sm:hidden">{isMicOn ? 'On' : 'Off'}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Right Sidebar - Chat/Transcript */}
      <aside className="w-full md:w-[380px] lg:w-[450px] bg-panel-bg border-t md:border-t-0 md:border-l border-gray-800 flex flex-col h-[50vh] md:h-screen shrink-0 relative z-10 shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-black/20 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-300 ${activePersona.id === 'ari' ? 'bg-ari/10' : 'bg-popo/10'}`}>
              <MessageSquare className={`w-5 h-5 transition-colors duration-300 ${activePersona.id === 'ari' ? 'text-ari' : 'text-popo'}`} />
            </div>
            <h2 className="font-semibold text-gray-100 tracking-wide">Live Transcript</h2>
          </div>
          {isConnected && (
            <div className="flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-40 ${activePersona.id === 'ari' ? 'bg-ari' : 'bg-popo'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${activePersona.id === 'ari' ? 'bg-ari' : 'bg-popo'}`}></span>
            </div>
          )}
        </div>
        
        <div className="flex-1 p-5 overflow-y-auto space-y-6 font-sans text-sm pb-8 custom-scrollbar">
          
          {messages.length === 0 ? (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ml-1 transition-colors duration-300 ${activePersona.id === 'ari' ? 'text-ari' : 'text-popo'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activePersona.id === 'ari' ? 'bg-ari' : 'bg-popo'}`}></span>
                Menu Whisperer
              </span>
              <div className="bg-gray-800/60 rounded-2xl rounded-tl-sm p-4 text-gray-300 border border-gray-700/50 shadow-inner leading-relaxed">
                Hey {activePersona.name.split(' ')[0]}! Start a session and point your camera at a menu to begin.
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1.5 animate-fade-in ${msg.role === 'user' ? 'items-end' : ''}`}>
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${msg.role === 'user' ? 'text-gray-400 mr-1' : (activePersona.id === 'ari' ? 'text-ari ml-1' : 'text-popo ml-1')}`}>
                  {msg.role === 'model' && <span className={`w-1.5 h-1.5 rounded-full ${activePersona.id === 'ari' ? 'bg-ari' : 'bg-popo'}`}></span>}
                  {msg.role === 'model' ? 'Menu Whisperer' : activePersona.name.split(' ')[0]}
                </span>
                <div className={`rounded-2xl p-4 text-gray-300 border shadow-inner leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-black/40 rounded-tr-sm border-gray-800 text-right max-w-[85%]' 
                    : 'bg-gray-800/60 rounded-tl-sm border-gray-700/50'
                }`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Status Bar */}
        <div className="p-4 bg-black/40 border-t border-gray-800 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 bg-dark-bg rounded-xl border border-gray-800 shadow-inner">
            <div className="flex gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? (activePersona.id === 'ari' ? 'bg-ari animate-bounce' : 'bg-popo animate-bounce') : 'bg-gray-500'}`} style={{animationDelay: '0ms'}}></div>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? (activePersona.id === 'ari' ? 'bg-ari animate-bounce' : 'bg-popo animate-bounce') : 'bg-gray-500'}`} style={{animationDelay: '150ms'}}></div>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? (activePersona.id === 'ari' ? 'bg-ari animate-bounce' : 'bg-popo animate-bounce') : 'bg-gray-500'}`} style={{animationDelay: '300ms'}}></div>
            </div>
            <span className="text-sm text-gray-400 italic">
              {isConnected ? (isMicOn ? `Listening to ${activePersona.name.split(' ')[0]}...` : `Session active for ${activePersona.name.split(' ')[0]}. Enable mic to talk.`) : 'Offline'}
            </span>
          </div>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.3);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(75, 85, 99, 0.5);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}} />
    </div>
  )
}

export default App
