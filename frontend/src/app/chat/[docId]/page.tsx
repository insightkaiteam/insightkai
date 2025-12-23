"use client";
import { useState, use, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic, Send, ArrowLeft, StopCircle, Loader2, FileText } from 'lucide-react';
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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/documents/${docId}/status`);
        if (res.ok) {
            const data = await res.json();
            if (data.summary) {
                const cleanSummary = data.summary.split("---_SEPARATOR_---")[0].replace("**Content Summary:**", "").trim();
                setMessages([{ role: 'ai', content: `**Ready.**\n\n${cleanSummary}` }]);
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
    } catch (e) { setMessages(prev => [...prev, { role: 'ai', content: "Error." }]); } 
    finally { setIsLoading(false); }
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

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    try {
      const res = await fetch(`${BACKEND_URL}/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) sendMessage(data.text); 
    } catch (error) { console.error("Error", error); } 
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#F3F4F6] font-sans overflow-hidden">
      
      {/* LEFT: PDF VIEWER */}
      <div className="w-1/2 bg-gray-900 border-r border-gray-800 flex flex-col relative">
        <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center px-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition flex items-center gap-2 text-sm font-bold tracking-wide">
                <ArrowLeft size={16} /> LIBRARY
            </Link>
        </div>
        <iframe src={`${BACKEND_URL}/documents/${docId}/download`} className="flex-1 w-full border-none" title="PDF Viewer" />
      </div>

      {/* RIGHT: CHAT */}
      <div className="w-1/2 flex flex-col bg-white relative">
        <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-40">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ai' && <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-serif italic font-bold mr-3 mt-1 shadow-md">κ</div>}
                <div className={`p-5 max-w-[85%] rounded-3xl text-sm leading-relaxed shadow-sm ${
                    m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                    <div className={`prose prose-sm ${m.role === 'user' ? 'prose-invert' : ''}`}>
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>
                    </div>
                </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start items-center gap-2 ml-11">
                <Loader2 size={16} className="animate-spin text-gray-400" /> <span className="text-xs text-gray-400 font-medium">Processing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* FLOATY INPUT BAR */}
        <div className="absolute bottom-8 left-0 w-full px-8 flex justify-center">
          <div className={`bg-white border border-gray-200 shadow-2xl rounded-[2rem] p-2 flex gap-2 items-center transition-all duration-300 w-full max-w-3xl ${isRecording ? 'ring-4 ring-red-50 border-red-100' : 'focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-200'}`}>
            <button
                onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black'}`}
            >
                {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
            </button>

            <textarea 
                className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-32 placeholder:text-gray-400" 
                rows={1}
                value={input} 
                onChange={e=>setInput(e.target.value)} 
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                placeholder={isRecording ? "Listening..." : "Ask a question..."}
                disabled={isRecording || isLoading}
            />
            
            <button onClick={() => sendMessage()} className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg">
                <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}