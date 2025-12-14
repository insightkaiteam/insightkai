"use client";
import { useState, use, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic } from 'lucide-react'; // Import Mic Icon

// ⚠️ REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- SEND TEXT MESSAGE ---
  const sendMessage = async (textOverride?: string) => {
    const messageToSend = textOverride || input;
    if (!messageToSend.trim()) return;

    const userMsg = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, document_id: docId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error: Backend not reachable." }]);
    } finally { setIsLoading(false); }
  };

  // --- AUDIO RECORDING FUNCTIONS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsLoading(true); // Show loading while transcribing
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      const res = await fetch(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.text) {
        // Automatically send the transcribed text
        sendMessage(data.text); 
      }
    } catch (error) {
      console.error("Transcription failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* LEFT SIDE: Real PDF Viewer */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700">
        <iframe
          src={`${BACKEND_URL}/documents/${docId}/download`}
          className="w-full h-full"
          title="PDF Viewer"
        />
      </div>

      {/* RIGHT SIDE: Chat */}
      <div className="w-1/2 flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-lg max-w-[90%] ${m.role === 'user' ? 'bg-blue-100 self-end ml-auto' : 'bg-gray-100'}`}>
              {m.role === 'ai' ? (
                  <div className="prose text-sm">
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
            </div>
          ))}
          {isLoading && <p className="text-gray-400 p-4 text-sm animate-pulse">{isRecording ? "Listening..." : "Thinking..."}</p>}
        </div>
        
        <div className="p-4 border-t flex gap-2 items-center">
          {/* AUDIO BUTTON */}
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording} // Stop if they drag mouse away
            className={`p-3 rounded-full transition-colors ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Hold to Speak"
          >
            <Mic size={20} />
          </button>

          <input 
            className="flex-1 border p-2 rounded" 
            value={input} 
            onChange={e=>setInput(e.target.value)} 
            onKeyDown={e=>e.key==='Enter' && sendMessage()}
            placeholder="Type or hold Mic to speak..."
            disabled={isRecording || isLoading}
          />
          <button onClick={() => sendMessage()} className="bg-black text-white px-4 py-2 rounded">Send</button>
        </div>
      </div>
    </div>
  );
}