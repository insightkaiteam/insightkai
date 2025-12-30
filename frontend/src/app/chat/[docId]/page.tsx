"use client";
import { useState, use, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic, Send, ArrowLeft, StopCircle, Loader2, Quote, MapPin } from 'lucide-react';
import Link from 'next/link';

// PDF VIEWER IMPORTS
import { Worker, Viewer, DocumentLoadEvent } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { searchPlugin, SingleKeyword } from '@react-pdf-viewer/search';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';

// ⚠️ REPLACE WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 

const Typewriter = ({ content, animate = false }: { content: string, animate?: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(animate ? "" : content);
  const hasAnimated = useRef(!animate);
  useEffect(() => {
    if (hasAnimated.current) { setDisplayedContent(content); return; }
    let i = -1;
    const speed = 5; 
    const timer = setInterval(() => {
      i++;
      if (i <= content.length) setDisplayedContent(content.slice(0, i));
      else { clearInterval(timer); hasAnimated.current = true; }
    }, speed);
    return () => clearInterval(timer);
  }, [content, animate]);
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{displayedContent}</ReactMarkdown>;
};

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // PDF State
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 1. INITIALIZE PLUGINS
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;

  const searchPluginInstance = searchPlugin();
  const { highlight, clearHighlights } = searchPluginInstance;

  // 2. RADICAL SIMPLE STRATEGY (Literal Anchor Swarm)
  const handleCitationClick = (clickedCit: any) => {
    if (!clickedCit.page) return;
    
    // A. Jump to the page first
    jumpToPage(clickedCit.page - 1);

    // B. Construct Targets
    const text = clickedCit.content.replace(/["“”]/g, "").trim(); // Remove quotes, keep spaces
    const words = text.split(/\s+/);
    
    // We will collect multiple "Plain String" keywords
    const targets: string[] = [];

    // 1. FULL TEXT (The obvious choice)
    targets.push(text);

    // 2. ANCHORS (The "As Is" Fragments)
    if (words.length > 6) {
        // Head: First 3 words
        const head = words.slice(0, 3).join(" ");
        targets.push(head);

        // Tail: Last 3 words
        const tail = words.slice(-3).join(" ");
        targets.push(tail);

        // Middle: Middle 3 words
        const midIndex = Math.floor(words.length / 2);
        const middle = words.slice(midIndex - 1, midIndex + 2).join(" ");
        targets.push(middle);
    }

    // 3. Fallback for strange spacing (First 5 chars + Last 5 chars)
    // If words fail, maybe these unique strings will catch
    if (text.length > 20) {
        targets.push(text.substring(0, 8)); // First 8 chars
        targets.push(text.substring(text.length - 8)); // Last 8 chars
    }

    // C. HIGHLIGHT EXECUTION
    // We pass an array of simple strings. The viewer handles the rest.
    // We use a retry mechanism to handle the PDF rendering delay.
    
    const keywords: SingleKeyword[] = targets.map(t => ({
        keyword: t,
        matchCase: false
    }));

    // Clear previous, then try highlighting 3 times
    clearHighlights();
    
    const attemptHighlight = () => {
        if (keywords.length > 0) highlight(keywords);
    };

    attemptHighlight(); // Immediate
    setTimeout(attemptHighlight, 500); // After 500ms
    setTimeout(attemptHighlight, 1500); // After 1.5s (Aggressive fallback)
  };

  const sendMessage = async (textOverride?: string) => {
    const messageToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!messageToSend.trim()) return;
    const userMsg = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); 
    setIsLoading(true);
    try {
      const historyPayload = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, document_id: docId, history: historyPayload }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.answer, citations: data.citations }]);
    } catch (error) { setMessages(prev => [...prev, { role: 'ai', content: "Sorry, something went wrong." }]); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* LEFT: SOTA PDF VIEWER */}
      <div className="w-1/2 h-full border-r border-gray-200 bg-white relative">
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer
            fileUrl={`${BACKEND_URL}/documents/${docId}/download`}
            plugins={[pageNavigationPluginInstance, searchPluginInstance]}
          />
        </Worker>
        <div className="absolute top-4 left-4 z-20">
            <Link href="/dashboard" className="p-2 bg-white/90 backdrop-blur border border-gray-200 rounded-xl hover:bg-black hover:text-white transition shadow-sm flex items-center justify-center">
                <ArrowLeft size={20} />
            </Link>
        </div>
      </div>

      {/* RIGHT: CHAT INTERFACE */}
      <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
        <div className="p-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <h1 className="font-bold text-xl tracking-tight text-gray-900">Document Chat</h1>
            <p className="text-xs text-gray-400 font-medium mt-1">SOTA Analyst Mode</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[#fafafa]">
            {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                        {m.role === 'ai' ? <div className="prose prose-sm"><Typewriter content={m.content} animate={i === messages.length - 1} /></div> : <div className="prose prose-sm prose-invert"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
                    </div>

                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-3 space-y-2 w-[85%]">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} /> Source Highlights</p>
                            {m.citations.slice(0, 12).map((cit: any, idx: number) => (
                                <div key={idx} onClick={() => handleCitationClick(cit)} className="bg-white border border-gray-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Page {cit.page}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 italic line-clamp-2 group-hover:text-gray-900 transition-colors">"{cit.content}"</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            <div ref={messagesEndRef} />
            {isLoading && <div className="flex items-center gap-2 text-xs text-gray-400 px-4 animate-pulse"><Loader2 size={12} className="animate-spin" /> Analyzing document...</div>}
        </div>

        <div className="p-5 border-t border-gray-100 bg-white">
            <div className={`flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:ring-4 focus-within:ring-blue-50`}>
                <textarea 
                    className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-32 placeholder:text-gray-400 focus:outline-none" 
                    rows={1}
                    value={input} 
                    onChange={e=>setInput(e.target.value)} 
                    onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Ask a question..."
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