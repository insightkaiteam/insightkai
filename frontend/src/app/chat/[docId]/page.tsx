"use client";
import { useState, use, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic, Send, ArrowLeft, StopCircle, Loader2, Quote, MapPin } from 'lucide-react';
import Link from 'next/link';

// PDF VIEWER IMPORTS
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { highlightPlugin, RenderHighlightsProps } from '@react-pdf-viewer/highlight';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

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
  const [isRecording, setIsRecording] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 1. HIGHLIGHT PLUGIN SETUP
  const highlightPluginInstance = highlightPlugin({
    renderHighlights: (props: RenderHighlightsProps) => (
      <div>
        {activeHighlight && activeHighlight.pageIndex === props.pageIndex && (
          <div
            style={{
              background: 'rgba(255, 255, 0, 0.4)',
              position: 'absolute',
              left: `${activeHighlight.left}%`,
              top: `${activeHighlight.top}%`,
              width: `${activeHighlight.width}%`,
              height: `${activeHighlight.height}%`,
              pointerEvents: 'none',
              zIndex: 10,
              borderRadius: '2px',
              border: '1px solid rgba(255, 215, 0, 0.5)'
            }}
          />
        )}
      </div>
    ),
  });

  const { jumpToPage } = highlightPluginInstance;

  // 2. CITATION CLICK HANDLER
  const handleCitationClick = (cit: any) => {
    if (!cit.page) return;
    
    // Scroll to page (0-indexed)
    jumpToPage(cit.page - 1);

    // Map Mistral coordinates [ymin, xmin, ymax, xmax] to percentages
    if (cit.coords && cit.coords.length === 4) {
      const [ymin, xmin, ymax, xmax] = cit.coords;
      setActiveHighlight({
        pageIndex: cit.page - 1,
        top: ymin / 10,
        left: xmin / 10,
        width: (xmax - xmin) / 10,
        height: (ymax - ymin) / 10,
      });
    }
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

  // ... (startRecording/stopRecording remain the same)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* LEFT: SOTA PDF VIEWER */}
      <div className="w-1/2 h-full border-r border-gray-200 bg-white relative">
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer
            fileUrl={`${BACKEND_URL}/documents/${docId}/download`}
            plugins={[highlightPluginInstance]}
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
                            {m.citations.map((cit: any, idx: number) => (
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
        </div>

        <div className="p-5 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:ring-4 focus-within:ring-blue-50">
                {/* ... (Mic, Textarea, Send button remain the same) */}
            </div>
        </div>
      </div>
    </div>
  );
}