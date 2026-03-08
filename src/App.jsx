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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    return () => { if (intervalId) clearInterval(intervalId); };
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

  return (
    <div className="min-h-screen bg-dark-bg text-gray-800 flex flex-col md:flex-row font-nunito">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Banner */}
        <header className="p-4 md:p-5 border-b border-gray-200 bg-white/70 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <div>
                <h1 className="text-2xl font-extrabold">
                  <span className="text-g-blue">M</span>
                  <span className="text-g-red">e</span>
                  <span className="text-g-yellow">n</span>
                  <span className="text-g-blue">u</span>
                  {' '}
                  <span className="text-g-green">W</span>
                  <span className="text-g-red">h</span>
                  <span className="text-g-yellow">i</span>
                  <span className="text-g-blue">s</span>
                  <span className="text-g-green">p</span>
                  <span className="text-g-red">e</span>
                  <span className="text-g-yellow">r</span>
                  <span className="text-g-blue">e</span>
                  <span className="text-g-green">r</span>
                </h1>
                <p className="text-gray-400 italic text-xs mt-0.5">Your AI local friend, anywhere in the world 🌍</p>
              </div>
            </div>

            {/* Persona Switcher */}
            <div className="flex-1 flex flex-col gap-2 sm:items-end">
              <div className="flex gap-2">
                {PERSONAS.map((persona) => {
                  const isActive = persona.id === activePersona.id;
                  const colorClasses = persona.id === 'ari'
                    ? isActive 
                      ? 'bg-g-blue text-white shadow-lg shadow-g-blue/25 border-g-blue' 
                      : 'bg-transparent text-gray-400 border-gray-300 hover:border-g-blue/50 hover:text-g-blue'
                    : isActive
                      ? 'bg-g-red text-white shadow-lg shadow-g-red/25 border-g-red'
                      : 'bg-transparent text-gray-400 border-gray-300 hover:border-g-red/50 hover:text-g-red';

                  return (
                    <button
                      key={persona.id}
                      onClick={() => switchPersona(persona)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-200 active:scale-95 ${colorClasses}`}
                    >
                      <span>{persona.id === 'ari' ? '🍜' : '🥩'}</span>
                      {persona.name}
                    </button>
                  );
                })}
              </div>
              
              <div className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                activePersona.id === 'ari' 
                  ? 'bg-g-blue/10 border-g-blue/20 text-g-blue' 
                  : 'bg-g-red/10 border-g-red/20 text-g-red'
              }`}>
                {activePersona.bio}
              </div>
            </div>
          </div>
        </header>

        {/* Camera Area */}
        <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center relative bg-gray-50/50 min-h-[40vh]">
          <div className="w-full h-full max-w-4xl bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center shadow-2xl overflow-hidden relative group">
            {stream ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-800 z-20">
                  <span className="w-2 h-2 rounded-full bg-g-green animate-pulse"></span>
                  <span className="text-xs font-semibold text-white tracking-widest uppercase">Live</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-5xl mb-3 group-hover:scale-110 transition-transform">📷</span>
                <p className="text-gray-400 font-medium tracking-wide pb-4">Camera Feed Offline</p>
              </>
            )}
            
            {/* Google-colored viewfinder corners */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-g-blue opacity-70 pointer-events-none z-10"></div>
            <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-g-red opacity-70 pointer-events-none z-10"></div>
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-g-yellow opacity-70 pointer-events-none z-10"></div>
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-g-green opacity-70 pointer-events-none z-10"></div>
          </div>
        </main>

        {/* Bottom Controls */}
        <footer className="p-4 md:p-6 bg-white/60 border-t border-gray-200 backdrop-blur-md shrink-0">
          <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-3 sm:gap-4">
            
            {!isConnected ? (
              <button onClick={handleConnect} className={`flex items-center gap-2 px-5 py-3 sm:px-8 sm:py-4 font-bold rounded-full transition-all shadow-lg active:scale-95 ${
                activePersona.id === 'ari' 
                  ? 'bg-g-blue hover:bg-g-blue-dark text-white shadow-g-blue/20' 
                  : 'bg-g-red hover:bg-g-red-dark text-white shadow-g-red/20'
              }`}>
                <Play className="w-5 h-5" fill="currentColor" />
                Start Session
              </button>
            ) : (
              <button onClick={disconnect} className="flex items-center gap-2 px-5 py-3 sm:px-8 sm:py-4 bg-g-red hover:bg-g-red-dark text-white font-bold rounded-full transition-all shadow-lg shadow-g-red/20 active:scale-95">
                <Square className="w-5 h-5" fill="currentColor" />
                Stop Session
              </button>
            )}
            <button 
              onClick={toggleWebcam}
              className="flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-4 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded-full transition-all active:scale-95 shadow-md"
            >
              {stream ? <VideoOff className="w-5 h-5 text-gray-500" /> : <Video className="w-5 h-5 text-gray-500" />}
              <span className="hidden sm:inline">{stream ? 'Webcam Off' : 'Webcam On'}</span>
              <span className="sm:hidden">{stream ? 'Off' : 'Cam'}</span>
            </button>
            
            <button 
              onClick={toggleMic}
              disabled={!isConnected}
              className={`flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-4 border font-medium rounded-full transition-all shadow-md
                ${!isConnected ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' 
                  : isMicOn 
                    ? 'bg-g-green text-white border-g-green shadow-g-green/20'
                    : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-700 active:scale-95'}
              `}>
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-gray-500" />}
              <span className="hidden sm:inline">{isMicOn ? 'Mic On' : 'Mic Off'}</span>
              <span className="sm:hidden">{isMicOn ? 'On' : 'Off'}</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Right Sidebar */}
      <aside className="w-full md:w-[380px] lg:w-[450px] bg-panel-bg border-t md:border-t-0 md:border-l border-gray-200 flex flex-col h-[50vh] md:h-screen shrink-0 relative z-10 shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-g-yellow/15 rounded-lg">
              <MessageSquare className="w-5 h-5 text-g-yellow" />
            </div>
            <h2 className="font-semibold text-gray-800 tracking-wide">Live Transcript 💬</h2>
          </div>
          {isConnected && (
            <div className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-g-green opacity-40"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-g-green"></span>
            </div>
          )}
        </div>
        
        <div className="flex-1 p-5 overflow-y-auto space-y-6 text-sm pb-8 custom-scrollbar">
          
          {messages.length === 0 ? (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ml-1 ${activePersona.id === 'ari' ? 'text-g-blue' : 'text-g-red'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activePersona.id === 'ari' ? 'bg-g-blue' : 'bg-g-red'}`}></span>
                Menu Whisperer 🍴
              </span>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-4 text-gray-600 border border-gray-200 shadow-sm leading-relaxed">
                Hey {activePersona.name.split(' ')[0]}! 👋 Start a session and point your camera at a menu to begin.
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1.5 animate-fade-in ${msg.role === 'user' ? 'items-end' : ''}`}>
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${msg.role === 'user' ? 'text-gray-400 mr-1' : (activePersona.id === 'ari' ? 'text-g-blue ml-1' : 'text-g-red ml-1')}`}>
                  {msg.role === 'model' && <span className={`w-1.5 h-1.5 rounded-full ${activePersona.id === 'ari' ? 'bg-g-blue' : 'bg-g-red'}`}></span>}
                  {msg.role === 'model' ? '🍴 Menu Whisperer' : `${activePersona.name.split(' ')[0]}`}
                </span>
                <div className={`rounded-2xl p-4 border shadow-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-gray-50 rounded-tr-sm border-gray-200 text-gray-700 text-right max-w-[85%]' 
                    : 'bg-gray-100 rounded-tl-sm border-gray-200 text-gray-600'
                }`}>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Status Bar */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-g-blue animate-bounce' : 'bg-gray-300'}`} style={{animationDelay: '0ms'}}></div>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-g-red animate-bounce' : 'bg-gray-300'}`} style={{animationDelay: '150ms'}}></div>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-g-yellow animate-bounce' : 'bg-gray-300'}`} style={{animationDelay: '300ms'}}></div>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-g-green animate-bounce' : 'bg-gray-300'}`} style={{animationDelay: '450ms'}}></div>
            </div>
            <span className="text-sm text-gray-500 italic">
              {isConnected ? (isMicOn ? `Listening to ${activePersona.name.split(' ')[0]}... 🎙️` : `Session active for ${activePersona.name.split(' ')[0]} ✨`) : 'Offline'}
            </span>
          </div>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(209, 213, 219, 0.5); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(209, 213, 219, 0.8); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}} />
    </div>
  )
}

export default App
