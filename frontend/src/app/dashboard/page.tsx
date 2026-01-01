"use client";
import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Folder, Trash2, Plus, ArrowLeft, ArrowRight,
  X, Send, Loader2, FileClock, BrainCircuit, UploadCloud, 
  LayoutGrid, LogOut, Quote, FileSearch, Mic, StopCircle, Zap,
  CheckCircle2, AlertCircle, Clock, FileText, ChevronRight, ChevronDown, Maximize2, Settings,
  Filter, MoreHorizontal, MessageSquare, File, User, GraduationCap, Briefcase, Code2, Phone, Mail
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

interface Doc {
  id: string;
  title: string;
  folder: string;
  status: string;
  summary: string;
  upload_date: string;
}

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
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
  
  // -- ACTIVE DOC STATE --
  const [activeDoc, setActiveDoc] = useState<{id: string, title: string, initialQuote?: string, page?: number} | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // PDF Viewer Plugins
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  const searchPluginInstance = searchPlugin();
  const { highlight, clearHighlights } = searchPluginInstance;
  const [pdfDocument, setPdfDocument] = useState<any>(null);

  // Upload State
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  
  // Chat State
  const [chatMode, setChatMode] = useState<'simple' | 'deep' | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Prompt Settings
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptSettings, setShowPromptSettings] = useState(false);

  // Filtering State
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // --- PDF VIEWER LOGIC ---
  const handleDocumentLoad = (e: DocumentLoadEvent) => {
      setPdfDocument(e.doc);
      if (activeDoc?.initialQuote && activeDoc?.page) {
          setTimeout(() => performHighlight(activeDoc.initialQuote!, activeDoc.page!), 500);
      }
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
    } catch (err) { console.error("Highlight error:", err); }
  };

  const onCitationClick = (docId: string, sourceName: string, quote: string, page: number) => {
      if (activeDoc?.id !== docId) {
          setActiveDoc({ id: docId, title: sourceName, initialQuote: quote, page });
      } else {
          performHighlight(quote, page);
      }
  };

  const toggleSourceExpansion = (sourceKey: string) => {
      const newSet = new Set(expandedSources);
      if (newSet.has(sourceKey)) newSet.delete(sourceKey);
      else newSet.add(sourceKey);
      setExpandedSources(newSet);
  };

  // --- DATA LOADING & AUTH ---
  useEffect(() => { 
    if (localStorage.getItem('auth_token') === SITE_PASSWORD) {
        setIsAuthenticated(true);
        refreshData();
    }
  }, []);

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

      const remaining = uploadQueue.filter(i => i.status === 'pending').length;
      if (remaining > 1) await new Promise(resolve => setTimeout(resolve, 10000));
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
    if (passwordInput === SITE_PASSWORD) {
        localStorage.setItem('auth_token', SITE_PASSWORD);
        setIsAuthenticated(true);
        refreshData();
    } else { alert("Incorrect Password"); }
  };

  const handleCreateFolder = async () => { if(!newFolderName.trim()) return; await fetch(`${BACKEND_URL}/folders`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: newFolderName }) }); setNewFolderName(""); setShowNewFolderInput(false); refreshData(); };
  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => { e.stopPropagation(); if (!confirm(`Delete?`)) return; await fetch(`${BACKEND_URL}/folders/${folderName}`, { method: 'DELETE' }); refreshData(); };
  const handleDelete = async (docId: string, e: React.MouseEvent) => { e.stopPropagation(); if(!confirm("Delete?")) return; await fetch(`${BACKEND_URL}/documents/${docId}`, { method: 'DELETE' }); refreshData(); };
  
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
  
  // -- FIXED FILE SELECT HANDLER --
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { 
      if (!e.target.files) return; 
      setUploadQueue(prev => [...prev, ...Array.from(e.target.files!).map(file => ({ id: Math.random().toString(36).substr(2, 9), file, status: 'pending' as const }))]); 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
  };
  
  const cancelUploads = () => setUploadQueue(prev => prev.filter(i => i.status !== 'pending'));
  const clearCompleted = () => setUploadQueue([]);
  
  // PARSING
  const parseSummary = (rawSummary: string) => { 
      if (!rawSummary) return { tag: "General", desc: "No description available." }; 
      const tagMatch = rawSummary.match(/\[TAG\]:\s*(.*?)(?=\n|\[|$)/i); 
      const descMatch = rawSummary.match(/\[DESC\]:\s*(.*?)(?=\n|\[|$)/i); 
      return { 
          tag: tagMatch ? tagMatch[1].trim() : "General", 
          desc: descMatch ? descMatch[1].trim() : (rawSummary.slice(0, 100) + "...")
      }; 
  };

  // -- UPDATED: NEUTRAL COLORS (MAC STYLE) --
  const getTagStyle = (tag: string) => { 
      const t = tag.toUpperCase();
      if(t.includes("INVOICE")) return 'bg-gray-100 text-gray-700 border-gray-200';
      if(t.includes("RESEARCH") || t.includes("PAPER")) return 'bg-zinc-50 text-zinc-700 border-zinc-200';
      if(t.includes("FINANC")) return 'bg-slate-50 text-slate-700 border-slate-200';
      if(t.includes("LEGAL")) return 'bg-gray-50 text-gray-800 border-gray-300';
      return 'bg-gray-50 text-gray-600 border-gray-200';
  };

  // RESUME PARSER
  const safeParseResume = (jsonStr: string) => {
      try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.structured) return parsed.structured;
      } catch (e) {}
      return null;
  };

  // --- CHAT ---
  const toggleChat = (mode: 'simple' | 'deep') => {
    if (chatMode === mode) {
        setChatMode(null);
        setShowPromptSettings(false);
    } else {
        setChatMode(mode);
        setCustomPrompt(mode === 'deep' ? DEFAULT_DEEP_PROMPT : DEFAULT_FAST_PROMPT);
    }
  };

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
        body: JSON.stringify({ 
            message: msgToSend, 
            folder_name: currentFolder, 
            mode: chatMode, 
            history: historyPayload,
            custom_prompt: customPrompt
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.answer, citations: data.citations || [] }]);
    } catch (e) { setChatMessages(prev => [...prev, { role: 'ai', content: "Error reaching backend." }]); } 
    finally { setIsChatLoading(false); }
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafafa] p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 w-full max-w-sm text-center">
            <h2 className="text-2xl font-bold mb-6 tracking-tight">insight<span className="font-serif italic">κ</span>AI</h2>
            <input type="password" className="w-full bg-gray-50 border p-3 rounded-xl mb-4 text-center focus:ring-2 focus:ring-black/10 outline-none" placeholder="Access Key" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
            <button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:scale-105 transition transform">Enter</button>
        </div>
    </div>
  );

  // Filter Logic
  const filteredDocs = docs.filter(d => d.folder === currentFolder);
  const uniqueTags = Array.from(new Set(filteredDocs.map(d => parseSummary(d.summary).tag))).filter(t => t);
  const displayedDocs = selectedTag ? filteredDocs.filter(d => parseSummary(d.summary).tag === selectedTag) : filteredDocs;

  // VIEW MODE SWITCHER (Resume vs Standard)
  const isResumeMode = currentFolder === "Hiring Kai";

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden font-sans text-gray-900 relative">
      
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-8 gap-8 z-20 shrink-0">
        <Link href="/" className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-serif italic font-bold text-xl shadow-lg">κ</Link>
        <div className="flex flex-col gap-4">
            <button onClick={() => { setCurrentFolder(null); setChatMode(null); setActiveDoc(null); }} className={`p-3 rounded-xl transition ${!currentFolder ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}>
                <LayoutGrid size={24} />
            </button>
        </div>
        <div className="mt-auto">
            <button className="p-3 text-gray-400 hover:text-red-500 transition"><LogOut size={20} /></button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className={`flex-1 overflow-hidden transition-all duration-500 ${chatMode ? 'mr-[400px]' : ''} flex flex-col relative`}>
        
        {/* VIEW 1: PDF VIEWER (Active Doc) */}
        {activeDoc ? (
            <div className="flex-1 flex flex-col h-full bg-white relative">
                <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white/95 backdrop-blur z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setActiveDoc(null)} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft size={20} className="text-gray-600"/></button>
                        <h2 className="font-bold text-gray-900 truncate max-w-md">{activeDoc.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">Read Mode</span>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden relative bg-gray-50/50">
                    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                        <Viewer
                            fileUrl={`${BACKEND_URL}/documents/${activeDoc.id}/download`}
                            plugins={[pageNavigationPluginInstance, searchPluginInstance]}
                            onDocumentLoad={handleDocumentLoad}
                        />
                    </Worker>
                </div>
            </div>
        ) : (
            /* VIEW 2: DASHBOARD (FOLDERS OR FILE TABLE) */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <div className="px-8 pt-8 pb-4 shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            {currentFolder && (
                                <button onClick={() => { setCurrentFolder(null); setChatMode(null); }} className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-black rounded-full shadow-sm"><ArrowLeft size={20} /></button>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-gray-900 line-clamp-1">{currentFolder || "My Library"}</h1>
                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">{currentFolder ? "Folder View" : "Dashboard"}</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            {!currentFolder && (
                                <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full hover:shadow-lg hover:scale-105 transition text-sm font-bold"><Plus size={16} /> New Folder</button>
                            )}
                        </div>
                    </div>

                    {/* NEW: FILTER BAR FOR FILES */}
                    {currentFolder && (
                        <div className="flex flex-col gap-4">
                            {/* Action Row */}
                            <div className="flex items-center gap-3 flex-wrap">
                                
                                {/* --- MOVED UPLOAD BUTTON TO LEFT --- */}
                                <label className="flex items-center justify-center gap-2 bg-black text-white px-5 py-3 rounded-xl cursor-pointer hover:bg-gray-800 transition shadow-lg text-sm font-bold relative overflow-hidden min-w-[160px] flex-1">
                                    <><UploadCloud size={16} /> {isResumeMode ? "Upload Resumes" : "Upload PDFs"}</>
                                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" multiple onChange={handleFileSelect} />
                                </label>

                                <button onClick={() => toggleChat('simple')} className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition text-sm font-bold border shadow-sm ${chatMode === 'simple' ? 'bg-white text-black border-black ring-2 ring-black/10' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                                    <Zap size={16} className={chatMode === 'simple' ? "fill-black" : "fill-none"} /> Fast Chat
                                </button>
                                <button onClick={() => toggleChat('deep')} className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition text-sm font-bold border shadow-sm ${chatMode === 'deep' ? 'bg-white text-black border-black ring-2 ring-black/10' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                                    <BrainCircuit size={16} /> Deep Chat
                                </button>
                            </div>

                            {/* Tag Filters (Only for Standard View) */}
                            {!isResumeMode && uniqueTags.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    <button 
                                        onClick={() => setSelectedTag(null)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${!selectedTag ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        All Files
                                    </button>
                                    {uniqueTags.map(tag => (
                                        <button 
                                            key={tag}
                                            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${selectedTag === tag ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* NEW FOLDER INPUT */}
                {showNewFolderInput && (
                    <div className="px-8 pb-6 animate-in fade-in slide-in-from-top-4">
                        <div className="flex gap-3">
                            <input className="border-2 border-gray-200 p-3 rounded-2xl w-72 shadow-sm focus:outline-none focus:border-black transition" placeholder="Folder Name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
                            <button onClick={handleCreateFolder} className="bg-black text-white px-6 rounded-2xl font-bold">Create</button>
                            <button onClick={() => setShowNewFolderInput(false)} className="text-gray-400 px-4 hover:text-black">Cancel</button>
                        </div>
                    </div>
                )}

                {/* CONTENT: FOLDER GRID or FILE TABLE */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
                    {!currentFolder ? (
                        /* FOLDERS GRID */
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {folders.map(folder => (
                                <div key={folder} onClick={() => setCurrentFolder(folder)} className="group bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition"><Folder size={24} fill="currentColor" className="text-gray-300 group-hover:text-blue-200" /></div>
                                        {folder !== "General" && <button onClick={(e) => handleDeleteFolder(folder, e)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>}
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-900 mb-1">{folder}</h3>
                                    <p className="text-xs text-gray-400 font-medium">{docs.filter(d => d.folder === folder).length} items</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                {/* DYNAMIC HEADERS */}
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                                        <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[25%]">Name</th>
                                        {isResumeMode ? (
                                            <>
                                                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[20%]">Contact</th>
                                                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[20%]">Education</th>
                                                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[20%]">Experience</th>
                                                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[15%]">Skills</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[40%]">Summary</th>
                                                <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider w-[15%]">Tag</th>
                                            </>
                                        )}
                                        <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {displayedDocs.map((doc) => {
                                        const resumeData = isResumeMode ? safeParseResume(doc.summary) : null;
                                        const { tag, desc } = parseSummary(doc.summary);

                                        return (
                                            <tr key={doc.id} onClick={() => setActiveDoc({id: doc.id, title: doc.title})} className="group hover:bg-gray-50 transition-colors cursor-pointer">
                                                {/* 1. Name Column */}
                                                <td className="py-4 px-6 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center shrink-0 border border-gray-200">
                                                            {doc.status === 'processing' ? <Loader2 size={16} className="animate-spin"/> : (isResumeMode ? <User size={16} /> : <FileText size={16} />)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm text-gray-900 line-clamp-1">{resumeData ? resumeData.name : doc.title}</div>
                                                            <div className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1 tabular-nums">
                                                                <Clock size={10} /> {doc.upload_date}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 2. Dynamic Content Columns */}
                                                {isResumeMode && resumeData ? (
                                                    <>
                                                        <td className="py-4 px-6 align-top text-xs text-gray-500">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1"><Mail size={10}/> {resumeData.email}</span>
                                                                <span className="flex items-center gap-1"><Phone size={10}/> {resumeData.phone}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-6 align-top text-xs text-gray-600 leading-relaxed"><div className="line-clamp-3">{resumeData.education}</div></td>
                                                        <td className="py-4 px-6 align-top text-xs text-gray-600 leading-relaxed"><div className="line-clamp-3">{resumeData.experience}</div></td>
                                                        <td className="py-4 px-6 align-top">
                                                            <div className="flex flex-wrap gap-1">
                                                                {resumeData.skills?.split(',').slice(0,3).map((s:string, i:number) => (
                                                                    <span key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border border-gray-200 whitespace-nowrap">{s.trim()}</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    // Standard View
                                                    <>
                                                        <td className="py-4 px-6 align-top">
                                                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{desc}</p>
                                                        </td>
                                                        <td className="py-4 px-6 align-top">
                                                            <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${getTagStyle(tag)}`}>
                                                                {tag}
                                                            </span>
                                                        </td>
                                                    </>
                                                )}

                                                <td className="py-4 px-6 align-top text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {doc.status !== 'processing' && (
                                                            <Link href={`/chat/${doc.id}`} onClick={(e) => e.stopPropagation()}>
                                                                <button className="px-3 py-1.5 bg-black text-white text-[10px] font-bold rounded-lg hover:scale-105 transition shadow-sm flex items-center gap-1.5" title="Chat with this Doc">
                                                                    <MessageSquare size={12} /> Chat
                                                                </button>
                                                            </Link>
                                                        )}
                                                        <button 
                                                            onClick={(e) => handleDelete(doc.id, e)} 
                                                            className="p-1.5 bg-white border border-gray-200 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition shadow-sm"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {displayedDocs.length === 0 && (
                                <div className="py-16 flex flex-col items-center justify-center text-center text-gray-400">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                        <FileSearch size={24} className="opacity-20" />
                                    </div>
                                    <p className="text-sm font-medium">No files found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* 3. UPLOAD QUEUE */}
      {uploadQueue.length > 0 && (
          <div className="fixed bottom-6 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
              <div className="bg-black text-white p-3 flex justify-between items-center">
                  <span className="text-xs font-bold flex items-center gap-2">
                      {uploadQueue.some(i => i.status === 'uploading') ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12}/>}
                      Upload Queue ({uploadQueue.filter(i => i.status === 'completed').length}/{uploadQueue.length})
                  </span>
                  <div className="flex gap-2">
                      <button onClick={cancelUploads} className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition">Cancel</button>
                      <button onClick={clearCompleted} className="hover:text-gray-300"><X size={14}/></button>
                  </div>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                  {uploadQueue.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-xs">
                          <span className="truncate max-w-[180px] font-medium text-gray-700">{item.file.name}</span>
                          <span>
                              {item.status === 'pending' && <Clock size={14} className="text-gray-400" />}
                              {item.status === 'uploading' && <Loader2 size={14} className="animate-spin text-blue-500" />}
                              {item.status === 'completed' && <CheckCircle2 size={14} className="text-green-500" />}
                              {item.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                          </span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 4. CHAT SIDEBAR */}
      <aside className={`fixed top-0 right-0 h-full w-[400px] bg-white/90 backdrop-blur-2xl border-l border-gray-200 shadow-2xl z-30 transform transition-transform duration-500 ${chatMode ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/80">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md ${chatMode === 'simple' ? 'bg-black' : 'bg-gradient-to-br from-gray-700 to-gray-900'}`}>
                    {chatMode === 'simple' ? <Zap size={16} /> : <BrainCircuit size={16} />}
                </div>
                <div>
                    <h2 className="font-bold text-lg leading-tight">{chatMode === 'simple' ? "Fast Chat" : "Deep Chat"}</h2>
                    <p className="text-xs text-gray-400 font-medium">{chatMode === 'simple' ? "Instant answers" : "Full analysis"}</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => setShowPromptSettings(!showPromptSettings)} className={`p-2 rounded-full transition ${showPromptSettings ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-400'}`}>
                    <Settings size={18} />
                </button>
                <button onClick={() => setChatMode(null)} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20} className="text-gray-400"/></button>
            </div>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-5 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'}`}>
                        {m.role === 'ai' ? <div className="prose prose-sm"><Typewriter content={m.content} animate={i === chatMessages.length - 1} /></div> : <div className="prose prose-sm prose-invert"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
                    </div>
                    
                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-4 w-full animate-in fade-in slide-in-from-top-2 duration-500 space-y-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Quote size={10} /> Verified Sources</p>
                            {groupCitations(m.citations).map((group, gIdx) => {
                                const groupKey = group.docId + group.source;
                                const isExpanded = expandedSources.has(groupKey);
                                const visibleQuotes = isExpanded ? group.quotes : group.quotes.slice(0, 3);
                                const hiddenCount = group.quotes.length - 3;

                                return (
                                    <div key={gIdx} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        <div onClick={() => onCitationClick(group.docId, group.source, group.quotes[0].content, group.quotes[0].page)} className="bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition group/header">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className="bg-gray-100 p-1 rounded text-gray-600"><FileText size={12}/></div>
                                                <span className="text-xs font-bold text-gray-700 truncate">{group.source}</span>
                                            </div>
                                            <ChevronRight size={14} className="text-gray-300 group-hover/header:text-blue-500"/>
                                        </div>
                                        
                                        <div className="divide-y divide-gray-100">
                                            {visibleQuotes.map((cit, cIdx) => (
                                                <div key={cIdx} onClick={() => onCitationClick(group.docId, group.source, cit.content, cit.page)} className="block p-3 hover:bg-gray-100 transition-colors cursor-pointer group/quote">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono bg-white border border-gray-200 px-1.5 rounded text-gray-500 group-hover/quote:border-blue-200 group-hover/quote:text-blue-500">P.{cit.page}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 italic line-clamp-2 border-l-2 border-transparent pl-2 group-hover/quote:border-blue-400 group-hover/quote:text-gray-900 transition-all">"{cit.content}"</p>
                                                </div>
                                            ))}
                                            
                                            {hiddenCount > 0 && !isExpanded && (
                                                <button onClick={() => toggleSourceExpansion(groupKey)} className="w-full p-2 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider hover:bg-gray-100 hover:text-black transition flex items-center justify-center gap-1">
                                                    <ChevronDown size={10} /> Show {hiddenCount} more
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
            {isChatLoading && <div className="flex items-center gap-3 text-sm text-gray-500 animate-pulse"><div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"><Loader2 size={16} className="animate-spin"/></div><span>Analyzing documents...</span></div>}
        </div>

        <div className="p-6 bg-white border-t border-gray-100">
            <div className="flex gap-3 relative items-center max-w-4xl mx-auto">
                <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} disabled={isChatLoading} className={`p-4 rounded-2xl transition-all duration-200 ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200 ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-black hover:text-white'}`}>
                    {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
                </button>
                <div className="flex-1 relative">
                    <input className="w-full bg-gray-100 border-none rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 placeholder:text-gray-400 transition-all" placeholder={isRecording ? "Listening..." : `Ask ${chatMode === 'simple' ? 'Fast' : 'Deep'} Chat...`} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendFolderMessage()} disabled={isRecording} />
                    <button onClick={sendFolderMessage} className="absolute right-2 top-2 p-2 bg-white text-black rounded-xl hover:scale-110 shadow-sm transition"><Send size={18}/></button>
                </div>
            </div>
        </div>
      </aside>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}