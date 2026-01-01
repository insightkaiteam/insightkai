"use client";
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Mic, Send, ArrowLeft, StopCircle, Loader2, Quote, MapPin, FileText, ChevronRight, Settings } from 'lucide-react';
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

const DEFAULT_SINGLE_DOC_PROMPT = `You are a Senior Financial Analyst. Answer based ONLY on the provided context.
You must return a JSON object with two keys:
1. 'answer': A markdown string formatted strictly as follows:
   **Executive Summary**
   [A 2-3 sentence high-level summary of the findings]

   **Key Insights**
   - **[Insight Title]:** [Detailed explanation of 2-3 sentences. Explain WHY this matters.]
   - **[Insight Title]:** [Detailed explanation...]

2. 'quotes': An array of strings. Copy the EXACT sentences used to derive the answer.
   - Rule: Use CONTEXTUAL QUOTING. Do not just quote a number. Quote the full sentence containing the number so it is verifiable.
   - Aim for 5-7 distinct citations if the text supports it.
   - Do NOT modify the text inside the quotes.`;

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

const groupCitations = (citations: any[]) => {
    const groups: { [key: string]: { docId: string, source: string, quotes: any[] } } = {};
    citations.forEach(cit => {
        const key = cit.document_id || cit.source || "Current Doc";
        if (!groups[key]) groups[key] = { docId: cit.document_id, source: cit.source, quotes: [] };
        groups[key].quotes.push(cit);
    });
    return Object.values(groups);
};

export default function ChatPage({ params }: { params: any }) {
  // SAFE UNWRAP PARAMS
  const [docId, setDocId] = useState<string>("");
  
  useEffect(() => {
    // Handle both Promise (Next 15) and Object (Next 14) params
    Promise.resolve(params).then((p) => setDocId(p.docId));
  }, [params]);

  const [messages, setMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Prompt Settings
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SINGLE_DOC_PROMPT);
  const [showPromptSettings, setShowPromptSettings] = useState(false);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // PDF State
  const [pdfDocument, setPdfDocument] = useState<any>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Plugins
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  const searchPluginInstance = searchPlugin();
  const { highlight, clearHighlights } = searchPluginInstance;

  const handleDocumentLoad = (e: DocumentLoadEvent) => {
      setPdfDocument(e.doc);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.webm");
        setInput("Transcribing...");
        try {
          const res = await fetch(`${BACKEND_URL}/transcribe`, { method: "POST", body: formData });
          const data = await res.json();
          setInput(data.text);
        } catch (e) { setInput(""); alert("Transcription failed"); }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleCitationClick = async (cit: any) => {
    if (!cit.page) return;
    jumpToPage(cit.page - 1);

    if (pdfDocument && cit.content) {
        try {
            const page = await pdfDocument.getPage(cit.page);
            const textContent = await page.getTextContent();
            const pageString = textContent.items.map((item: any) => item.str).join(' ').replace(/\s+/g, ' ').toLowerCase();
            const rawCit = cit.content.replace(/["“”]/g, "").trim(); 
            const words = rawCit.split(/\s+/);
            let matchFound = false;
            const validKeywords: SingleKeyword[] = [];

            for (let windowSize = 6; windowSize >= 3; windowSize--) {
                if (matchFound) break; 
                let i = 0;
                while (i <= words.length - windowSize) {
                    const chunkWords = words.slice(i, i + windowSize);
                    const chunkString = chunkWords.join(' ');
                    if (pageString.includes(chunkString.toLowerCase())) {
                        validKeywords.push({ keyword: chunkString, matchCase: false });
                        matchFound = true; 
                        i += windowSize;
                    } else { i++; }
                }
            }
            if (!matchFound && words.length < 3) {
                if (pageString.includes(rawCit.toLowerCase())) {
                    validKeywords.push({ keyword: rawCit, matchCase: false });
                }
            }
            clearHighlights();
            if (validKeywords.length > 0) highlight(validKeywords);
        } catch (err) { console.error("Error finding text match:", err); }
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
        body: JSON.stringify({ 
            message: messageToSend, 
            document_id: docId, 
            history: historyPayload,
            custom_prompt: customPrompt 
        }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.answer, citations: data.citations }]);
    } catch (error) { setMessages(prev => [...prev, { role: 'ai', content: "Sorry, something went wrong." }]); }
    finally { setIsLoading(false); }
  };

  if (!docId) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin"/></div>;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* LEFT: SOTA PDF VIEWER */}
      <div className="w-1/2 h-full border-r border-gray-200 bg-white relative">
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer
            fileUrl={`${BACKEND_URL}/documents/${docId}/download`}
            plugins={[pageNavigationPluginInstance, searchPluginInstance]}
            onDocumentLoad={handleDocumentLoad} 
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
        <div className="p-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
            <div>
                <h1 className="font-bold text-xl tracking-tight text-gray-900">Document Chat</h1>
                <p className="text-xs text-gray-400 font-medium mt-1">SOTA Analyst Mode</p>
            </div>
            <button onClick={() => setShowPromptSettings(!showPromptSettings)} className={`p-2 rounded-full transition ${showPromptSettings ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-400'}`}>
                <Settings size={18} />
            </button>
        </div>

        {showPromptSettings && (
            <div className="bg-gray-50 p-4 border-b border-gray-200 animate-in slide-in-from-top-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">System Instructions (The Brain)</p>
                <textarea 
                    className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 focus:border-black focus:ring-0 h-32 bg-white"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                />
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[#fafafa]">
            {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                        {m.role === 'ai' ? <div className="prose prose-sm"><Typewriter content={m.content} animate={i === messages.length - 1} /></div> : <div className="prose prose-sm prose-invert"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
                    </div>

                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-3 w-[85%] space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} /> Source Highlights</p>
                            {groupCitations(m.citations).map((group, gIdx) => (
                                <div key={gIdx} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="bg-blue-100 p-1 rounded text-blue-600"><FileText size={12}/></div>
                                            <span className="text-xs font-bold text-gray-700 truncate">{group.source || "This Document"}</span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {group.quotes.slice(0, 5).map((cit, cIdx) => (
                                            <div key={cIdx} onClick={() => handleCitationClick(cit)} className="block p-3 hover:bg-gray-100 transition-colors cursor-pointer group/quote">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white border border-gray-200 px-1.5 rounded text-gray-500 group-hover/quote:border-blue-200 group-hover/quote:text-blue-500">Page {cit.page}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 italic line-clamp-2 border-l-2 border-transparent pl-2 group-hover/quote:border-blue-400 group-hover/quote:text-gray-900 transition-all">"{cit.content}"</p>
                                            </div>
                                        ))}
                                    </div>
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
                
                <button 
                    onMouseDown={startRecording} 
                    onMouseUp={stopRecording} 
                    onMouseLeave={stopRecording} 
                    disabled={isLoading}
                    className={`p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200 ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-black hover:text-white'}`}
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
                    disabled={isRecording}
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