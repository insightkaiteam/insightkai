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
import { searchPlugin } from '@react-pdf-viewer/search';

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

// --- HELPER: Escape Regex Characters ---
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // PDF State
  const [pdfDocument, setPdfDocument] = useState<any>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 1. INITIALIZE PLUGINS
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;

  const searchPluginInstance = searchPlugin();
  const { highlight, clearHighlights } = searchPluginInstance;

  // 2. CAPTURE PDF DOCUMENT ON LOAD
  const handleDocumentLoad = (e: DocumentLoadEvent) => {
      setPdfDocument(e.doc);
  };

  // 3. SOTA NORMALIZATION MAPPING HIGHLIGHTER
  const handleCitationClick = async (clickedCit: any) => {
    if (!clickedCit.page) return;
    
    // A. Jump to the page first
    jumpToPage(clickedCit.page - 1);

    // B. Find ALL citations on this page (Auto-Batching)
    const lastAiMsg = messages.slice().reverse().find(m => m.role === 'ai');
    const citationsOnPage = lastAiMsg?.citations?.filter((c: any) => c.page === clickedCit.page) || [clickedCit];

    if (pdfDocument && citationsOnPage.length > 0) {
        try {
            // 1. Get RAW text items from the page
            const page = await pdfDocument.getPage(clickedCit.page); // Note: getPage uses 0-based index internally often, but let's assume cit.page is 1-based.
            // Actually, pdfjs getPage is 1-based usually, or check documentation. 
            // BUT: pdfDocument.getPage(i) often expects index (0..N). 
            // If cit.page is 1-based, we might need (clickedCit.page - 1).
            // Let's rely on the previous logic which worked for page navigation.
            
            const textContent = await page.getTextContent();
            
            // 2. Build the "Normalization Map"
            // We construct a 'skeleton' string (normText) and map every character index back to the fullText.
            let fullText = "";
            let normText = "";
            const indexMap: number[] = [];

            for (const item of textContent.items) {
                const str = item.str; 
                for (let i = 0; i < str.length; i++) {
                    const char = str[i];
                    // If it's a letter/number, add to skeleton and record index
                    if (/[a-zA-Z0-9]/.test(char)) {
                        normText += char.toLowerCase();
                        indexMap.push(fullText.length);
                    }
                    fullText += char;
                }
                // PDF text items are often individual words or lines. We add a space for safety in the full text.
                fullText += " "; 
            }

            // We use 'any[]' to bypass strict TypeScript checks
            const keywordsToHighlight: any[] = [];

            // 3. Process Citations
            citationsOnPage.forEach((cit: any) => {
                // Clean the citation to be a skeleton too
                const cleanCit = cit.content.replace(/["“”]/g, ""); // Remove quotes
                const normCit = cleanCit.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

                if (!normCit) return;

                // 4. Find the match in the SKELETON text
                // We search for the normalized quote in the normalized page text
                const matchIndex = normText.indexOf(normCit);

                if (matchIndex !== -1) {
                    // FOUND IT!
                    // 5. Map back to Original Text
                    const startIndex = indexMap[matchIndex];
                    const endIndex = indexMap[matchIndex + normCit.length - 1] + 1; // +1 to include last char
                    
                    // Extract the messy, original string from the PDF
                    const originalString = fullText.substring(startIndex, endIndex);

                    // 6. Create a Flexible Regex from the Original String
                    // Even though we extracted it, the viewer's rendering might differ slightly (e.g. whitespace handling).
                    // So we replace all whitespace in our extracted string with a flexible regex pattern.
                    const flexiblePattern = originalString.split('').map(char => {
                        // If the char is whitespace in our extraction, allow any whitespace in the viewer
                        if (/\s/.test(char)) return '[\\s\\n\\r\\u00AD\\u200B\\-]*';
                        return escapeRegExp(char);
                    }).join('');

                    keywordsToHighlight.push({
                        keyword: new RegExp(flexiblePattern, 'gi'),
                        matchCase: false
                    });
                } else {
                    // Fallback: If exact match fails (maybe OCR typo?), try Shingling (Overlapping Chunks)
                    // We grab chunks of the normalized citation
                    const chunkSize = 20; // 20 chars
                    if (normCit.length > chunkSize) {
                        for (let i = 0; i < normCit.length - chunkSize; i += 10) {
                            const chunk = normCit.substring(i, i + chunkSize);
                            const chunkIdx = normText.indexOf(chunk);
                            if (chunkIdx !== -1) {
                                const start = indexMap[chunkIdx];
                                const end = indexMap[chunkIdx + chunk.length - 1] + 1;
                                const chunkOriginal = fullText.substring(start, end);
                                
                                // Create regex for this chunk
                                const chunkPattern = chunkOriginal.split('').map(c => 
                                    /\s/.test(c) ? '[\\s\\n\\r\\u00AD\\u200B\\-]*' : escapeRegExp(c)
                                ).join('');

                                keywordsToHighlight.push({
                                    keyword: new RegExp(chunkPattern, 'gi'),
                                    matchCase: false
                                });
                            }
                        }
                    }
                }
            });

            // E. Execute Batch Highlight
            clearHighlights();
            if (keywordsToHighlight.length > 0) {
                highlight(keywordsToHighlight);
            } else {
                // Last Resort: Just try the literal text if all advanced matching failed
                highlight(citationsOnPage.map((c: any) => ({
                    keyword: c.content,
                    matchCase: false
                })));
            }

        } catch (err) {
            console.error("Error finding text match:", err);
        }
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* LEFT: SOTA PDF VIEWER */}
      <div className="w-1/2 h-full border-r border-gray-200 bg-white relative">
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer
            fileUrl={`${BACKEND_URL}/documents/${docId}/download`}
            plugins={[pageNavigationPluginInstance, searchPluginInstance]}
            onDocumentLoad={handleDocumentLoad} // Capture doc reference
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