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
  
  // A. Jump to page (existing logic - don't change)
  jumpToPage(clickedCit.page - 1);

  // B. Batch citations on same page (existing logic - don't change)
  const lastAiMsg = messages.slice().reverse().find(m => m.role === 'ai');
  const citationsOnPage = lastAiMsg?.citations?.filter(
    (c: any) => c.page === clickedCit.page
  ) || [clickedCit];

  if (!pdfDocument || citationsOnPage.length === 0) return;

  try {
    // 1. Extract page text (PDF.js getPage is 1-based)
    const page = await pdfDocument.getPage(clickedCit.page);
    const textContent = await page.getTextContent();
    
    // 2. Build full page text with item tracking
    let fullPageText = "";
    textContent.items.forEach((item: any) => {
      fullPageText += item.str + " ";
    });

    // 3. Normalization function (aggressive cleaning)
    const normalize = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[""'']/g, '"')      // Smart quotes
        .replace(/[\u00AD\u200B]/g, '') // Soft hyphens, zero-width spaces
        .replace(/\s+/g, ' ')          // Multiple spaces to single
        .replace(/[^\w\s]/g, '')       // Remove punctuation
        .trim();
    };

    const normalizedPage = normalize(fullPageText);
    const keywordsToHighlight: any[] = [];

    // 4. Process each citation with cascading thresholds
    citationsOnPage.forEach((cit: any) => {
      const rawCitation = cit.content;
      const normalizedCitation = normalize(rawCitation);
      
      // Skip if citation is too short
      if (normalizedCitation.length < 10) {
        console.warn(`Citation too short (${normalizedCitation.length} chars), skipping`);
        return;
      }

      let matched = false;
      const words = normalizedCitation.split(' ').filter(w => w.length > 0);
      
      // CASCADING THRESHOLD STRATEGY: 100% → 80% → 60% → 40% → 20%
      const thresholds = [1.0, 0.8, 0.6, 0.4, 0.2];
      
      for (const threshold of thresholds) {
        if (matched) break;
        
        const minWords = Math.max(3, Math.ceil(words.length * threshold));
        
        // Try sliding windows of different sizes at this threshold
        for (let windowSize = words.length; windowSize >= minWords; windowSize--) {
          if (matched) break;
          
          // Slide the window across the citation (ANYWHERE in citation)
          for (let start = 0; start <= words.length - windowSize; start++) {
            const windowWords = words.slice(start, start + windowSize);
            const windowText = windowWords.join(' ');
            
            // Check if this window exists in the page
            if (normalizedPage.includes(windowText)) {
              // FOUND A MATCH! Now find it in the original text
              const matchPosition = normalizedPage.indexOf(windowText);
              
              // Map back to original text position
              const originalMatch = findOriginalTextAtPosition(
                fullPageText,
                normalizedPage,
                matchPosition,
                windowText.length
              );
              
              if (originalMatch) {
                // Create flexible regex that handles spacing/hyphenation
                const pattern = createFlexiblePattern(originalMatch);
                keywordsToHighlight.push({
                  keyword: new RegExp(pattern, 'gi'),
                  matchCase: false
                });
                
                console.log(`✅ Match found at ${Math.round(threshold * 100)}% threshold: "${originalMatch.substring(0, 50)}..."`);
                matched = true;
                break;
              }
            }
          }
        }
      }
      
      // Fallback: Try key phrases if nothing matched
      if (!matched && words.length >= 3) {
        console.warn(`⚠️ No match found, trying key phrase fallback...`);
        
        // Extract most distinctive 3-word phrases
        for (let i = 0; i <= words.length - 3; i++) {
          const phrase = words.slice(i, i + 3).join(' ');
          if (normalizedPage.includes(phrase)) {
            const pos = normalizedPage.indexOf(phrase);
            const orig = findOriginalTextAtPosition(fullPageText, normalizedPage, pos, phrase.length);
            
            if (orig) {
              keywordsToHighlight.push({
                keyword: escapeRegExp(orig),
                matchCase: false
              });
              console.log(`✅ Key phrase match: "${orig}"`);
              matched = true;
              break;
            }
          }
        }
      }
      
      if (!matched) {
        console.error(`❌ Failed to find any match for citation on page ${cit.page}`);
      }
    });

    // 5. Execute highlight (with delay for render)
    clearHighlights();
    
    if (keywordsToHighlight.length > 0) {
      setTimeout(() => {
        highlight(keywordsToHighlight);
        console.log(`🎯 Highlighted ${keywordsToHighlight.length} citation(s)`);
      }, 150);
    } else {
      console.warn('⚠️ No highlights to display');
    }

  } catch (err) {
    console.error("❌ Citation highlighting error:", err);
  }
};

// HELPER: Map normalized position back to original text
function findOriginalTextAtPosition(
  originalText: string,
  normalizedText: string,
  normalizedPos: number,
  normalizedLength: number
): string | null {
  let origIdx = 0;
  let normIdx = 0;
  let startOrigIdx = -1;
  
  // Find start position
  while (origIdx < originalText.length && normIdx < normalizedPos) {
    const char = originalText[origIdx];
    const normChar = char.toLowerCase().replace(/[^\w\s]/g, '');
    
    if (normChar && normChar !== ' ') {
      normIdx++;
    } else if (char === ' ') {
      // Count spaces in normalized text
      const nextNormChar = normalizedText[normIdx];
      if (nextNormChar === ' ') normIdx++;
    }
    origIdx++;
  }
  
  startOrigIdx = origIdx;
  
  // Find end position
  let normCount = 0;
  while (origIdx < originalText.length && normCount < normalizedLength) {
    const char = originalText[origIdx];
    const normChar = char.toLowerCase().replace(/[^\w\s]/g, '');
    
    if (normChar && normChar !== ' ') {
      normCount++;
    } else if (char === ' ') {
      const nextNormChar = normalizedText[normalizedPos + normCount];
      if (nextNormChar === ' ') normCount++;
    }
    origIdx++;
  }
  
  const result = originalText.substring(startOrigIdx, origIdx).trim();
  return result.length > 0 ? result : null;
}

// HELPER: Create regex pattern that handles hyphenation and spacing
function createFlexiblePattern(text: string): string {
  // Split into words and allow flexible spacing/hyphens between them
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 1) {
    // Single word - just escape it
    return escapeRegExp(text);
  }
  
  // Multiple words - allow flexible spacing/hyphens between
  const pattern = words
    .map(word => escapeRegExp(word))
    .join('[\\s\\-\\u00AD\\u200B]*'); // Allow space, hyphen, soft hyphen, zero-width space
  
  return pattern;
}

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