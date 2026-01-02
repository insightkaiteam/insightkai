"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Folder, Trash2, Plus, ArrowLeft, ArrowRight,
  X, Send, Loader2, FileClock, BrainCircuit, UploadCloud, 
  LayoutGrid, LogOut, Quote, FileSearch, Mic, StopCircle, Zap,
  CheckCircle2, AlertCircle, Clock, FileText, ChevronRight, ChevronDown, Maximize2, Settings,
  Filter, MoreHorizontal, MessageSquare, File as FileIcon, User, GraduationCap, Briefcase, Code2, Phone, Mail
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// PDF VIEWER IMPORTS
import { Worker, Viewer, DocumentLoadEvent } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { searchPlugin, SingleKeyword } from '@react-pdf-viewer/search';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';

const BACKEND_URL = "https://insightkai.onrender.com";
const SITE_PASSWORD = "kai2025"; 

// --- DEFAULT PROMPTS ---
const DEFAULT_DEEP_PROMPT = `You are a Senior Financial Analyst. Answer based ONLY on the provided context.
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

const DEFAULT_FAST_PROMPT = `You are a Digital Librarian. You have access to high-level SUMMARIES of files.
Goal: Identify which file contains specific info or extract metadata.
Rules: Be concise. Use the summaries to answer.
Return JSON: { 'answer': '...', 'quotes': [] }`;

// --- CONFIGURATION FOR FOLDER VIEWS ---
const FOLDER_TABLE_CONFIG: any = {
  "Hiring Kai": {
    headers: [
      { label: "Candidate", width: "25%" },
      { label: "Contact", width: "15%" },
      { label: "Education", width: "20%" },
      { label: "Experience", width: "25%" },
      { label: "Skills", width: "15%" },
    ],
    mode: "resume"
  },
  "default": {
    headers: [
      { label: "Name", width: "35%" },
      { label: "Summary", width: "30%" },
      { label: "Tag", width: "15%" },
    ],
    mode: "standard"
  }
};

interface Doc {
  id: string; title: string; folder: string; status: string; summary: string; upload_date: string;
}
interface UploadItem {
  id: string; file: File; status: 'pending' | 'uploading' | 'completed' | 'error';
}

const Typewriter = ({ content, animate = false }: { content: string, animate?: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(animate ? "" : content);
  const hasAnimated = useRef(!animate);
  useEffect(() => {
    if (hasAnimated.current) { setDisplayedContent(content); return; }
    let i = -1;
    const speed = 5; 
    const timer = setInterval(() => {
      i++; if (i <= content.length) setDisplayedContent(content.slice(0, i));
      else { clearInterval(timer); hasAnimated.current = true; }
    }, speed);
    return () => clearInterval(timer);
  }, [content, animate]);
  return <ReactMarkdown>{displayedContent}</ReactMarkdown>;
};

const groupCitations = (citations: any[]) => {
    const groups: { [key: string]: { docId: string, source: string, quotes: any[] } } = {};
    citations.forEach(cit => {
        const key = cit.document_id || cit.source;
        if (!groups[key]) groups[key] = { docId: cit.document_id, source: cit.source, quotes: [] };
        groups[key].quotes.push(cit);
    });
    return Object.values(groups);
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const initialFolder = searchParams.get('folder');

  const [folders, setFolders] = useState<string[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(initialFolder);
  const [activeDoc, setActiveDoc] = useState<{id: string, title: string, initialQuote?: string, page?: number} | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // PDF Viewer Plugins
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  const searchPluginInstance = searchPlugin();
  const { highlight, clearHighlights } = searchPluginInstance;
  const [pdfDocument, setPdfDocument] = useState<any>(null);

  // Upload/Chat State
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [chatMode, setChatMode] = useState<'simple' | 'deep' | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // FIX: DEFINED REFS
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const handleDocumentLoad = (e: DocumentLoadEvent) => {
      setPdfDocument(e.doc);
      if (activeDoc?.initialQuote && activeDoc?.page) setTimeout(() => performHighlight(activeDoc.initialQuote!, activeDoc.page!), 500);
  };

  const performHighlight = async (quote: string, pageNum: number) => {
    if (!pdfDocument) return;
    jumpToPage(pageNum - 1);
    try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageString = textContent.items.map((item: any) => item.str).join(' ').replace(/\s+/g, ' ').toLowerCase();
        const rawCit = quote.replace(/["“”]/g, "").trim(); 
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
                    matchFound = true; i += windowSize;
                } else { i++; }
            }
        }
        if (!matchFound && words.length < 3) {
            if (pageString.includes(rawCit.toLowerCase())) { validKeywords.push({ keyword: rawCit, matchCase: false }); }
        }
        clearHighlights();
        if (validKeywords.length > 0) highlight(validKeywords);
    } catch (err) { console.error("Highlight error:", err); }
  };

  const onCitationClick = (docId: string, sourceName: string, quote: string, page: number) => {
      if (activeDoc?.id !== docId) { setActiveDoc({ id: docId, title: sourceName, initialQuote: quote, page }); } 
      else { performHighlight(quote, page); }
  };

  const toggleSourceExpansion = (sourceKey: string) => {
      const newSet = new Set(expandedSources);
      if (newSet.has(sourceKey)) newSet.delete(sourceKey);
      else newSet.add(sourceKey);
      setExpandedSources(newSet);
  };

  useEffect(() => { if (localStorage.getItem('auth_token') === SITE_PASSWORD) { setIsAuthenticated(true); refreshData(); } }, []);

  useEffect(() => {
    const processNext = async () => {
      if (isProcessingQueue) return;
      const nextItemIndex = uploadQueue.findIndex(item => item.status === 'pending');
      if (nextItemIndex === -1) return;
      setIsProcessingQueue(true);
      const item = uploadQueue[nextItemIndex];
      setUploadQueue(prev => prev.map((i, idx) => idx === nextItemIndex ? { ...i, status: 'uploading' } : i));
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('folder', currentFolder || "General");
        const res = await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Upload failed");
        setUploadQueue(prev => prev.map((i, idx) => idx === nextItemIndex ? { ...i, status: 'completed' } : i));
        refreshData();
      } catch (e) { setUploadQueue(prev => prev.map((i, idx) => idx === nextItemIndex ? { ...i, status: 'error' } : i)); }
      if (uploadQueue.filter(i => i.status === 'pending').length > 1) await new Promise(resolve => setTimeout(resolve, 1000));
      setIsProcessingQueue(false);
    };
    processNext();
  }, [uploadQueue, isProcessingQueue, currentFolder]);

  const refreshData = async () => {
    try {
        const [resFolders, resDocs] = await Promise.all([ fetch(`${BACKEND_URL}/folders`), fetch(`${BACKEND_URL}/documents`) ]);
        setFolders((await resFolders.json()).folders || ["General"]);
        setDocs((await resDocs.json()).documents || []);
    } catch (e) { console.error("Error fetching data", e); }
  };

  const handleLogin = () => {
    if (passwordInput === SITE_PASSWORD) { localStorage.setItem('auth_token', SITE_PASSWORD); setIsAuthenticated(true); refreshData(); } else { alert("Incorrect Password"); }
  };

  const handleCreateFolder = async () => { if(!newFolderName.trim()) return; await fetch(`${BACKEND_URL}/folders`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: newFolderName }) }); setNewFolderName(""); setShowNewFolderInput(false); refreshData(); };
  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => { e.stopPropagation(); if (!confirm(`Delete?`)) return; await fetch(`${BACKEND_URL}/folders/${folderName}`, { method: 'DELETE' }); refreshData(); };
  const handleDelete = async (docId: string, e: React.MouseEvent) => { e.stopPropagation(); if(!confirm("Delete?")) return; await fetch(`${BACKEND_URL}/documents/${docId}`, { method: 'DELETE' }); refreshData(); };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { 
      if (!e.target.files) return; 
      setUploadQueue(prev => [...prev, ...Array.from(e.target.files!).map(file => ({ id: Math.random().toString(36).substr(2, 9), file, status: 'pending' as const }))]); 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
  };
  
  const cancelUploads = () => setUploadQueue(prev => prev.filter(i => i.status !== 'pending'));
  const clearCompleted = () => setUploadQueue([]);
  
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
        setChatInput("Transcribing...");
        try { const res = await fetch(`${BACKEND_URL}/transcribe`, { method: "POST", body: formData }); const data = await res.json(); setChatInput(data.text); } catch (e) { setChatInput(""); alert("Transcription failed"); }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { alert("Microphone access denied."); }
  };
  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); } };

  const sendFolderMessage = async () => {
    if (!chatInput.trim() || !chatMode) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    const msgToSend = chatInput;
    setChatInput("");
    setIsChatLoading(true);
    try {
      const historyPayload = chatMessages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgToSend, folder_name: currentFolder, mode: chatMode, history: historyPayload, custom_prompt: customPrompt }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.answer, citations: data.citations || [] }]);
    } catch (e) { setChatMessages(prev => [...prev, { role: 'ai', content: "Error reaching backend." }]); } 
    finally { setIsChatLoading(false); }
  };

  // --- SMART PARSING LOGIC ---
  const parseCellData = (doc: Doc) => {
      try {
          // Robust parsing that handles markdown code blocks if present
          const cleanStr = doc.summary.replace(/```json/g, "").replace(/```/g, "").trim();
          if (cleanStr.startsWith("{")) {
              const json = JSON.parse(cleanStr);
              if (json.structured && json.type === 'resume') {
                  return { type: 'resume', data: json.structured };
              }
          }
      } catch(e) {}
      
      // Fallback: Standard Text
      const tagMatch = doc.summary.match(/\[TAG\]:\s*(.*?)(?=\n|\[|$)/i); 
      const descMatch = doc.summary.match(/\[DESC\]:\s*(.*?)(?=\n|\[|$)/i); 
      return { 
          type: 'standard', 
          tag: tagMatch ? tagMatch[1].trim() : "General", 
          desc: descMatch ? descMatch[1].trim() : (doc.summary.length > 50 ? doc.summary.slice(0, 100) + "..." : "Processing...")
      };
  };

  const getTagStyle = (tag: string) => { 
      const t = tag.toUpperCase();
      if(t.includes("INVOICE")) return 'bg-gray-100 text-gray-700 border-gray-200';
      if(t.includes("RESEARCH") || t.includes("PAPER")) return 'bg-zinc-50 text-zinc-700 border-zinc-200';
      if(t.includes("FINANC")) return 'bg-slate-50 text-slate-700 border-slate-200';
      if(t.includes("LEGAL")) return 'bg-gray-50 text-gray-800 border-gray-300';
      return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  if (!isAuthenticated) return <div className="min-h-screen flex items-center justify-center"><input className="border p-2" type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} /><button onClick={handleLogin} className="ml-2 bg-black text-white p-2">Login</button></div>;

  const currentConfig = FOLDER_TABLE_CONFIG[currentFolder || ""] || FOLDER_TABLE_CONFIG["default"];
  const filteredDocs = docs.filter(d => d.folder === currentFolder);
  const uniqueTags = currentConfig.mode === 'standard' ? Array.from(new Set(filteredDocs.map(d => parseCellData(d).tag))).filter(t => t) : [];
  const displayedDocs = selectedTag && currentConfig.mode !== 'resume' ? filteredDocs.filter(d => parseCellData(d).tag === selectedTag) : filteredDocs;

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden font-sans text-gray-900 relative">
      {/* SIDEBAR */}
      <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-8 gap-8 z-20 shrink-0">
        <Link href="/" className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-serif italic font-bold text-xl shadow-lg">κ</Link>
        <button onClick={() => { setCurrentFolder(null); setChatMode(null); setActiveDoc(null); }} className={`p-3 rounded-xl transition ${!currentFolder ? 'bg-zinc-100 text-black' : 'text-gray-400 hover:bg-gray-50'}`}><LayoutGrid size={24} /></button>
      </aside>

      {/* MAIN */}
      <div className={`flex-1 overflow-hidden flex flex-col relative ${chatMode ? 'mr-[400px]' : ''}`}>
        {activeDoc ? (
            <div className="flex-1 flex flex-col h-full bg-white relative">
                <div className="h-16 border-b border-gray-200 flex items-center px-6"><button onClick={() => setActiveDoc(null)}><ArrowLeft size={20}/></button><span className="ml-4 font-bold">{activeDoc.title}</span></div>
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                    <Viewer fileUrl={`${BACKEND_URL}/documents/${activeDoc.id}/download`} plugins={[pageNavigationPluginInstance, searchPluginInstance]} onDocumentLoad={handleDocumentLoad} />
                </Worker>
            </div>
        ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* HEADER */}
                <div className="px-8 pt-8 pb-4 shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold tracking-tight">{currentFolder || "My Library"}</h1>
                        {!currentFolder && <button onClick={() => setShowNewFolderInput(true)} className="bg-black text-white px-4 py-2 rounded-full flex gap-2"><Plus size={16} /> Folder</button>}
                    </div>
                    {currentFolder && (
                        <div className="flex gap-3 items-center">
                            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" multiple onChange={handleFileSelect} />
                            <button onClick={() => fileInputRef.current?.click()} className="bg-black text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><UploadCloud size={16}/> {currentConfig.mode === 'resume' ? "Upload Resumes" : "Upload PDFs"}</button>
                            <button onClick={() => {setChatMode('simple'); setCustomPrompt(DEFAULT_FAST_PROMPT)}} className="border px-4 py-2 rounded-lg text-sm font-bold flex gap-2"><Zap size={16}/> Fast Chat</button>
                            <button onClick={() => {setChatMode('deep'); setCustomPrompt(DEFAULT_DEEP_PROMPT)}} className="border px-4 py-2 rounded-lg text-sm font-bold flex gap-2"><BrainCircuit size={16}/> Deep Chat</button>
                            
                            {/* TAG FILTER (Only for Standard) */}
                            {currentConfig.mode !== 'resume' && uniqueTags.length > 0 && (
                                <div className="flex gap-2 ml-4">
                                    <button onClick={() => setSelectedTag(null)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${!selectedTag ? 'bg-black text-white' : 'bg-white'}`}>All</button>
                                    {uniqueTags.map(tag => <button key={tag} onClick={() => setSelectedTag(tag === selectedTag ? null : tag)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${selectedTag === tag ? 'bg-black text-white' : 'bg-white'}`}>{tag}</button>)}
                                </div>
                            )}
                        </div>
                    )}
                    {showNewFolderInput && <div className="mt-4 flex gap-2"><input className="border p-2 rounded" placeholder="Name" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} /><button onClick={handleCreateFolder} className="bg-black text-white px-4 rounded">Create</button></div>}
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto px-8 pb-8">
                    {!currentFolder ? (
                        <div className="grid grid-cols-4 gap-6">
                            {folders.map(f => (
                                <div key={f} onClick={() => setCurrentFolder(f)} className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-lg cursor-pointer">
                                    <div className="flex justify-between"><Folder className="text-gray-400"/><Trash2 size={16} onClick={(e) => handleDeleteFolder(f, e)} className="hover:text-red-500"/></div>
                                    <h3 className="mt-2 font-bold">{f}</h3>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border rounded-xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        {currentConfig.headers.map((h: any, i: number) => <th key={i} style={{width: h.width}} className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">{h.label}</th>)}
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {displayedDocs.map(doc => {
                                        const parsed = parseCellData(doc);
                                        return (
                                            <tr key={doc.id} onClick={() => setActiveDoc({id: doc.id, title: doc.title})} className="hover:bg-gray-50 cursor-pointer group">
                                                {/* NAME (Common) */}
                                                <td className="px-6 py-4 align-top"><div className="font-bold text-sm">{parsed.type === 'resume' ? parsed.data.name : doc.title}</div><div className="text-xs text-gray-400">{doc.upload_date}</div></td>
                                                
                                                {/* DYNAMIC COLUMNS */}
                                                {parsed.type === 'resume' ? (
                                                    <>
                                                        <td className="px-6 py-4 text-xs text-gray-500">{parsed.data.email}<br/>{parsed.data.phone}</td>
                                                        <td className="px-6 py-4 text-xs whitespace-pre-line">{parsed.data.education}</td>
                                                        <td className="px-6 py-4 text-xs whitespace-pre-line">{parsed.data.experience}</td>
                                                        <td className="px-6 py-4 text-xs">{parsed.data.skills}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-xs text-gray-500 line-clamp-2">{parsed.desc}</td>
                                                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs border ${getTagStyle(parsed.tag)}`}>{parsed.tag}</span></td>
                                                    </>
                                                )}
                                                
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/chat/${doc.id}`} onClick={e => e.stopPropagation()}><button className="p-2 border rounded hover:bg-black hover:text-white"><MessageSquare size={14}/></button></Link>
                                                        <button onClick={(e) => handleDelete(doc.id, e)} className="p-2 border rounded hover:text-red-500"><Trash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* CHAT SIDEBAR */}
      <aside className={`fixed top-0 right-0 h-full w-[400px] bg-white border-l shadow-2xl transition-transform ${chatMode ? 'translate-x-0' : 'translate-x-full'} flex flex-col z-30`}>
         <div className="p-4 border-b flex justify-between items-center"><h2 className="font-bold">Chat</h2><div className="flex gap-2"><button onClick={() => setShowPromptSettings(!showPromptSettings)}><Settings size={18}/></button><button onClick={() => setChatMode(null)}><X size={20}/></button></div></div>
         
         {showPromptSettings && <div className="p-4 bg-gray-50 border-b"><p className="text-xs font-bold mb-2">Brain Instructions</p><textarea className="w-full text-xs p-2 border rounded h-24" value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} /></div>}

         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((m, i) => (
                <div key={i}>
                    <div className={`p-4 rounded-xl text-sm ${m.role === 'user' ? 'bg-black text-white self-end' : 'bg-gray-100'}`}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                            <p className="font-bold mb-1 flex items-center gap-1"><Quote size={10}/> Sources:</p>
                            {groupCitations(m.citations).map((g, gi) => (
                                <div key={gi} className="mb-1 pl-2 border-l-2 cursor-pointer hover:text-black" onClick={() => onCitationClick(g.docId, g.source, g.quotes[0].content, g.quotes[0].page)}>
                                    <span className="font-bold">{g.source}</span> (p.{g.quotes[0].page})
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {isChatLoading && <div className="text-xs text-gray-400 animate-pulse">Thinking...</div>}
         </div>
         <div className="p-4 border-t flex gap-2">
            <button onMouseDown={startRecording} onMouseUp={stopRecording} className={`p-2 rounded ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-100'}`}>{isRecording ? <StopCircle size={20}/> : <Mic size={20}/>}</button>
            <input className="flex-1 border p-2 rounded" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendFolderMessage()} placeholder="Ask something..." />
            <button onClick={sendFolderMessage}><Send size={20}/></button>
         </div>
      </aside>
    </div>
  );
}

export default function Dashboard() {
  return <Suspense fallback={<div>Loading...</div>}><DashboardContent /></Suspense>;
}