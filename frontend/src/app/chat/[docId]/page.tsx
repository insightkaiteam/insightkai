"use client";
import { useState, use, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic, Send, ArrowLeft, StopCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

// ⚠️ REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/documents/${docId}/status`);
        if (res.ok) {
            const data = await res.json();
            if (data.summary) {
                // Clean up summary for display (remove logs)
                const cleanSummary = data.summary.split("---_SEPARATOR_---")[0].replace("**Content Summary:**", "").trim();
                setMessages([{ role: 'ai', content: `**Ready to chat.**\n\n${cleanSummary}` }]);
            }
        }
      } catch (e) { console.error("Failed to fetch manifest", e); }
    };
    fetchManifest();
  }, [docId]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    try {
      const res = await fetch(`${BACKEND_URL}/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) sendMessage(data.text); 
    } catch (error) { console.error("Transcription failed", error); } 
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#fafafa] font-sans">
      
      {/* LEFT: PDF VIEWER */}
      <div className="w-1/2 bg-gray-900 border-r border-gray-800 relative flex flex-col">
        <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                <ArrowLeft size={16} /> Back to Library
            </Link>
        </div>
        <iframe src={`${BACKEND_URL}/documents/${docId}/download`} className="flex-1 w-full" title="PDF Viewer" />
      </div>

      {/* RIGHT: CHAT */}
      <div className="w-1/2 flex flex-col bg-white relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${
                    m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                    <div className="prose prose-sm prose-p:my-1 prose-headings:my-2 max-w-none text-inherit">
                        {m.role === 'ai' ? 
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown> 
                        : m.content}
                    </div>
                </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
                <div className="bg-gray-50 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-2 items-center text-xs text-gray-400 font-medium">
                    <Loader2 size={12} className="animate-spin" /> Thinking...
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* INPUT AREA */}
        <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-white via-white to-transparent">
          <div className="bg-white border border-gray-200 shadow-xl rounded-2xl p-2 flex gap-2 items-end transition-all focus-within:ring-2 focus-within:ring-black/5 focus-within:border-gray-300">
            <button
                onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording}
                className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-50 text-red-600 animate-pulse' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            >
                {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </button>

            <textarea 
                className="flex-1 max-h-32 bg-transparent border-none focus:ring-0 p-3 text-sm resize-none" 
                rows={1}
                value={input} 
                onChange={e=>setInput(e.target.value)} 
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                placeholder="Ask a question about this document..."
                disabled={isRecording || isLoading}
            />
            
            <button onClick={() => sendMessage()} className="p-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors shadow-md">
                <Send size={18} />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-gray-300">InsightKai can make mistakes. Verify important info.</p>
          </div>
        </div>
      </div>
    </div>
  );
}