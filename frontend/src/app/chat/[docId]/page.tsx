"use client";
import { useState, use, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic, Send, ArrowLeft, StopCircle, Loader2, Quote, MapPin } from 'lucide-react';
import Link from 'next/link';

// ⚠️ REPLACE WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    setPdfUrl(`${BACKEND_URL}/documents/${docId}/download`);
    const fetchHistory = async () => {
       // Optional: Fetch previous chat history if you implement persistence later
    };
    fetchHistory();
  }, [docId]);

  // --- UPDATED SEND MESSAGE FUNCTION ---
  // Fix: Accepts an optional 'textOverride' string
  const sendMessage = async (textOverride?: string) => {
    // Determine the message to send: use the override if provided, otherwise use input state
    const messageToSend = typeof textOverride === 'string' ? textOverride : input;

    if (!messageToSend.trim()) return;

    // 1. Add User Message to UI
    const userMsg = { role: 'user', content: messageToSend };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    
    setInput(''); // Clear the input box
    setIsLoading(true);

    try {
      // 2. Prepare History Payload
      const historyPayload = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // 3. Send to Backend
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: messageToSend, // Use the local variable, not state
            document_id: docId,
            history: historyPayload 
        }),
      });

      if (!response.ok) throw new Error('Network error');
      const data = await response.json();

      // 4. Add AI Response
      setMessages(prev => [...prev, { 
          role: 'ai', 
          content: data.answer,
          citations: data.citations
      }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, something went wrong." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- AUDIO RECORDING ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");
        
        setIsLoading(true);
        try {
          const res = await fetch(`${BACKEND_URL}/transcribe`, { method: 'POST', body: formData });
          const data = await res.json();
          
          // Now this line works because we updated sendMessage signature
          if (data.text) sendMessage(data.text); 
          
        } catch (error) { console.error("Error", error); } 
        finally { setIsLoading(false); }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* LEFT: PDF VIEWER */}
      <div className="w-1/2 h-full border-r border-gray-200 bg-white shadow-sm hidden md:block relative group">
        {pdfUrl ? (
            <iframe 
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full"
                title="PDF Viewer"
            />
        ) : (
            <div className="flex items-center justify-center h-full text-gray-400 gap-2">
                <Loader2 className="animate-spin" /> Loading PDF...
            </div>
        )}
        <div className="absolute top-4 left-4">
            <Link href="/dashboard" className="p-2 bg-white/90 backdrop-blur border border-gray-200 rounded-xl hover:bg-black hover:text-white transition shadow-sm flex items-center justify-center">
                <ArrowLeft size={20} />
            </Link>
        </div>
      </div>

      {/* RIGHT: CHAT INTERFACE */}
      <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div>
                <h1 className="font-bold text-xl tracking-tight text-gray-900">Document Chat</h1>
                <p className="text-xs text-gray-400 font-medium mt-1">AI Financial Analyst Mode</p>
            </div>
            <Link href="/dashboard" className="md:hidden p-2 bg-gray-100 rounded-full"><ArrowLeft size={20}/></Link>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[#fafafa]">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                    <Quote size={48} className="opacity-20" />
                    <p className="text-sm font-medium">Ask questions about specific details in this file.</p>
                </div>
            )}

            {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Message Bubble */}
                    <div className={`p-4 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${
                        m.role === 'user' 
                        ? 'bg-black text-white rounded-br-none' 
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                    }`}>
                        <div className={`prose prose-sm ${m.role === 'user' ? 'prose-invert' : ''}`}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {m.content}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Citations */}
                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-3 space-y-2 w-[85%]">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <MapPin size={10} /> Source Highlights
                            </p>
                            {m.citations.map((cit: any, idx: number) => (
                                <Link 
                                    key={idx} 
                                    href={`${pdfUrl}#page=${cit.page}&:~:text=${encodeURIComponent(cit.content.substring(0,300))}`}
                                    target="pdf-frame"
                                    className="block group"
                                >
                                    <div className="bg-white border border-gray-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md transition-all cursor-pointer">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Page {cit.page}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 italic line-clamp-2 group-hover:text-gray-900 transition-colors">
                                            "{cit.content}"
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            <div ref={messagesEndRef} />
            {isLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-400 px-4 animate-pulse">
                    <Loader2 size={12} className="animate-spin" /> Analyzing document...
                </div>
            )}
        </div>

        {/* Input Bar */}
        <div className="p-5 border-t border-gray-100 bg-white">
            <div className={`flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-2 transition-all ${isRecording ? 'ring-4 ring-red-50 border-red-100' : 'focus-within:ring-4 focus-within:ring-blue-50 focus-within:border-blue-200'}`}>
                <button
                    onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200' : 'bg-white border border-gray-200 text-gray-400 hover:text-black hover:border-gray-300'}`}
                >
                    {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
                </button>

                <textarea 
                    className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-32 placeholder:text-gray-400 focus:outline-none" 
                    rows={1}
                    value={input} 
                    onChange={e=>setInput(e.target.value)} 
                    onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={isRecording ? "Listening..." : "Ask a question..."}
                    disabled={isRecording || isLoading}
                />
                
                <button onClick={() => sendMessage()} className="w-12 h-12 bg-black text-white rounded-xl hover:scale-105 active:scale-95 transition shadow-lg flex items-center justify-center">
                    <Send size={18} />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}