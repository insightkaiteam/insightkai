"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Folder, Trash2, Plus, ArrowLeft, ArrowRight,
  X, Send, Loader2, FileClock, BrainCircuit, UploadCloud, 
  LayoutGrid, LogOut, Quote, FileSearch, Mic, StopCircle, Zap,
  CheckCircle2, AlertCircle, Clock, FileText, ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ⚠️ REPLACE WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com";
const SITE_PASSWORD = "kai2025"; 

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

// --- TYPEWRITER COMPONENT ---
const Typewriter = ({ content, animate = false }: { content: string, animate?: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(animate ? "" : content);
  const hasAnimated = useRef(!animate);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplayedContent(content);
      return;
    }

    let i = -1;
    const speed = 5; 
    
    const timer = setInterval(() => {
      i++;
      if (i <= content.length) {
        setDisplayedContent(content.slice(0, i));
      } else {
        clearInterval(timer);
        hasAnimated.current = true;
      }
    }, speed);

    return () => clearInterval(timer);
  }, [content, animate]);

  return <ReactMarkdown>{displayedContent}</ReactMarkdown>;
};

// --- HELPER: Group Citations by Source File ---
const groupCitations = (citations: any[]) => {
    const groups: { [key: string]: { docId: string, source: string, quotes: any[] } } = {};
    
    citations.forEach(cit => {
        // Use document_id + source as key to ensure uniqueness
        const key = cit.document_id || cit.source;
        if (!groups[key]) {
            groups[key] = {
                docId: cit.document_id,
                source: cit.source,
                quotes: []
            };
        }
        groups[key].quotes.push(cit);
    });
    
    return Object.values(groups);
};

export default function Dashboard() {
  const [folders, setFolders] = useState<string[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  
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

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // --- 1. QUEUE PROCESSOR ---
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
      } catch (e) {
        setUploadQueue(prev => prev.map((i, idx) => idx === nextItemIndex ? { ...i, status: 'error' } : i));
      }

      const remaining = uploadQueue.filter(i => i.status === 'pending').length;
      if (remaining > 1) await new Promise(resolve => setTimeout(resolve, 10000));

      setIsProcessingQueue(false);
    };

    processNext();
  }, [uploadQueue, isProcessingQueue, currentFolder]);

  // --- 2. HANDLERS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newItems: UploadItem[] = Array.from(e.target.files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending'
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelUploads = () => setUploadQueue(prev => prev.filter(i => i.status !== 'pending'));
  const clearCompleted = () => setUploadQueue([]);

  const parseSummary = (rawSummary: string) => {
    if (!rawSummary) return { tag: null, desc: null };
    const tagMatch = rawSummary.match(/\[TAG\]:\s*(.*?)(?=\n|\[|$)/i);
    const descMatch = rawSummary.match(/\[DESC\]:\s*(.*?)(?=\n|\[|$)/i);
    return {
      tag: tagMatch ? tagMatch[1].trim().toUpperCase() : "FILE",
      desc: descMatch ? descMatch[1].trim() : "No description available."
    };
  };

  const getTagColor = (tag: string) => {
    const colors: {[key: string]: string} = {
      'INVOICE': 'bg-rose-50 text-rose-600 border-rose-200',
      'RESEARCH': 'bg-purple-50 text-purple-600 border-purple-200',
      'FINANCIAL': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      'LEGAL': 'bg-blue-50 text-blue-600 border-blue-200',
      'RECEIPT': 'bg-amber-50 text-amber-600 border-amber-200',
      'OTHER': 'bg-gray-50 text-gray-600 border-gray-200'
    };
    return colors[tag] || colors['OTHER'];
  };

  useEffect(() => { 
    if (localStorage.getItem('auth_token') === SITE_PASSWORD) {
        setIsAuthenticated(true);
        refreshData();
    }
  }, []);

  useEffect(() => {
    const processingDocs = docs.filter(d => d.status === 'processing');
    if (processingDocs.length > 0) {
        const interval = setInterval(refreshData, 3000);
        return () => clearInterval(interval);
    }
  }, [docs]);

  const refreshData = async () => {
    try {
        const [resFolders, resDocs] = await Promise.all([
            fetch(`${BACKEND_URL}/folders`),
            fetch(`${BACKEND_URL}/documents`)
        ]);
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

  const handleCreateFolder = async () => {
    if(!newFolderName.trim()) return;
    try {
        await fetch(`${BACKEND_URL}/folders`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: newFolderName })
        });
        setNewFolderName("");
        setShowNewFolderInput(false);
        refreshData();
    } catch(e) { alert("Failed to create folder"); }
  };

  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete folder "${folderName}"?`)) return;
    await fetch(`${BACKEND_URL}/folders/${folderName}`, { method: 'DELETE' });
    refreshData();
  };

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("Delete this file?")) return;
    await fetch(`${BACKEND_URL}/documents/${docId}`, { method: 'DELETE' });
    refreshData();
  };

  // --- AUDIO ---
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
        try {
          const res = await fetch(`${BACKEND_URL}/transcribe`, { method: "POST", body: formData });
          const data = await res.json();
          setChatInput(data.text);
        } catch (e) { setChatInput(""); alert("Transcription failed"); }
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

  // --- CHAT LOGIC ---
  const toggleChat = (mode: 'simple' | 'deep') => {
    if (chatMode === mode) setChatMode(null);
    else setChatMode(mode);
  };

  const sendFolderMessage = async () => {
    if (!chatInput.trim() || !chatMode) return;
    
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    
    const msgToSend = chatInput;
    setChatInput("");
    setIsChatLoading(true);
    
    try {
      // Pass History
      const historyPayload = chatMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: msgToSend, 
            folder_name: currentFolder, 
            mode: chatMode,
            history: historyPayload
        }),
      });
      const data = await res.json();
      
      setChatMessages(prev => [...prev, { 
          role: 'ai', 
          content: data.answer, 
          citations: data.citations || [] 
      }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "Error reaching backend." }]);
    } finally { setIsChatLoading(false); }
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

  return (
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden font-sans text-gray-900 relative">
      
      {/* 1. SIDEBAR */}
      <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-8 gap-8 z-20 shrink-0">
        <Link href="/" className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-serif italic font-bold text-xl shadow-lg">κ</Link>
        <div className="flex flex-col gap-4">
            <button onClick={() => { setCurrentFolder(null); setChatMode(null); }} className={`p-3 rounded-xl transition ${!currentFolder ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}>
                <LayoutGrid size={24} />
            </button>
        </div>
        <div className="mt-auto">
            <button className="p-3 text-gray-400 hover:text-red-500 transition"><LogOut size={20} /></button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT */}
      <div className={`flex-1 p-8 overflow-y-auto transition-all duration-500 ${chatMode ? 'mr-[400px]' : ''}`}>
        <div className="max-w-7xl mx-auto">
            
            {/* HEADER */}
            <header className="flex flex-col gap-6 mb-10">
                <div className="flex justify-between items-center">
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
                            <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-2 bg-white border border-gray-200 px-5 py-2.5 rounded-full hover:shadow-md transition text-sm font-bold"><Plus size={16} /> New Folder</button>
                        )}
                    </div>
                </div>

                {/* ACTIONS */}
                {currentFolder && (
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => toggleChat('simple')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition text-sm font-bold border shadow-sm ${chatMode === 'simple' ? 'bg-black text-white border-black ring-2 ring-black/20' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                            <Zap size={16} className={chatMode === 'simple' ? "fill-white" : "fill-none"} /> Fast Chat
                        </button>
                        <button onClick={() => toggleChat('deep')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition text-sm font-bold border shadow-sm ${chatMode === 'deep' ? 'bg-black text-white border-black ring-2 ring-black/20' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                            <BrainCircuit size={16} /> Deep Chat
                        </button>
                        
                        <label className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl cursor-pointer hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm font-bold relative overflow-hidden min-w-[140px]">
                            <><UploadCloud size={16} /> Upload PDFs</>
                            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf" multiple onChange={handleFileSelect} />
                        </label>
                    </div>
                )}
            </header>

            {showNewFolderInput && (
                <div className="mb-8 flex gap-3 animate-in fade-in slide-in-from-top-4">
                    <input className="border-2 border-gray-200 p-3 rounded-2xl w-72 shadow-sm focus:outline-none focus:border-black transition" placeholder="Folder Name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
                    <button onClick={handleCreateFolder} className="bg-black text-white px-6 rounded-2xl font-bold">Create</button>
                    <button onClick={() => setShowNewFolderInput(false)} className="text-gray-400 px-4 hover:text-black">Cancel</button>
                </div>
            )}

            {/* FOLDERS */}
            {!currentFolder && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {folders.map(folder => (
                        <div key={folder} onClick={() => setCurrentFolder(folder)} className="group bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition"><Folder size={24} fill="currentColor" className="text-gray-300 group-hover:text-blue-200" /></div>
                                {folder !== "General" && <button onClick={(e) => handleDeleteFolder(folder, e)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>}
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-1">{folder}</h3>
                            <p className="text-xs text-gray-400 font-medium">{docs.filter(d => d.folder === folder).length} items</p>
                        </div>
                    ))}
                </div>
            )}

            {/* FILES */}
            {currentFolder && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {docs.filter(doc => doc.folder === currentFolder).map((doc) => {
                        const { tag, desc } = parseSummary(doc.summary);
                        return (
                            <div key={doc.id} className="group bg-white p-5 rounded-3xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4 relative overflow-hidden h-full">
                                {doc.status === 'processing' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-100"><div className="h-full bg-blue-500 animate-progress origin-left"></div></div>}
                                
                                {/* ACTIONS COLUMN */}
                                <div className="flex flex-col gap-3 shrink-0 pt-1">
                                    {doc.status !== 'processing' ? (
                                        <Link href={`/chat/${doc.id}`} title="Chat with document">
                                            <button className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-gray-800 hover:scale-105 transition">
                                                <ArrowRight size={18} className="-rotate-45" />
                                            </button>
                                        </Link>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                            <Loader2 size={18} className="animate-spin text-gray-400"/>
                                        </div>
                                    )}
                                    
                                    <button onClick={(e) => handleDelete(doc.id, e)} className="w-10 h-10 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-xl flex items-center justify-center transition" title="Delete">
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {/* CONTENT COLUMN */}
                                <div className="min-w-0 flex-1 border-l border-gray-100 pl-4 py-1">
                                    <div className="flex items-start gap-2 mb-2 flex-wrap">
                                        <h3 className="font-bold text-gray-900 text-sm leading-snug break-words">{doc.title}</h3>
                                        {tag && <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border uppercase tracking-wider ${getTagColor(tag)}`}>{tag}</span>}
                                    </div>
                                    
                                    <p className="text-xs text-gray-500 leading-relaxed whitespace-normal break-words">
                                        {desc}
                                    </p>

                                    <div className="flex gap-4 mt-4 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                        <span className="flex items-center gap-1"><FileClock size={10}/> {doc.upload_date}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {docs.filter(doc => doc.folder === currentFolder).length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400">
                            <UploadCloud size={40} className="mb-4 text-gray-300"/>
                            <p className="font-medium">No files yet.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
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
                      {uploadQueue.some(i => i.status === 'pending') && 
                          <button onClick={cancelUploads} className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition">Cancel Pending</button>
                      }
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
              {uploadQueue.some(i => i.status === 'uploading' || i.status === 'pending') && (
                  <div className="px-3 py-1.5 bg-blue-50 text-[10px] text-blue-600 font-medium text-center border-t border-blue-100">
                      Processing files sequentially (10s delay to respect rate limits)
                  </div>
              )}
          </div>
      )}

      {/* 4. CHAT SIDEBAR (SOTA SOURCE CARDS) */}
      <aside className={`fixed top-0 right-0 h-full w-[400px] bg-white/90 backdrop-blur-2xl border-l border-gray-200 shadow-2xl z-30 transform transition-transform duration-500 ${chatMode ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/80">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md ${chatMode === 'simple' ? 'bg-black' : 'bg-gradient-to-br from-blue-600 to-purple-600'}`}>
                    {chatMode === 'simple' ? <Zap size={16} /> : <BrainCircuit size={16} />}
                </div>
                <div>
                    <h2 className="font-bold text-lg leading-tight">{chatMode === 'simple' ? "Fast Chat" : "Deep Chat"}</h2>
                    <p className="text-xs text-gray-400 font-medium">{chatMode === 'simple' ? "Instant answers" : "Full analysis"}</p>
                </div>
            </div>
            <button onClick={() => setChatMode(null)} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20} className="text-gray-400"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                    {chatMode === 'simple' ? <Zap size={48} className="mb-4 text-gray-300"/> : <BrainCircuit size={48} className="mb-4 text-gray-300"/>}
                    <p className="font-medium text-gray-500">Ready to analyze {docs.filter(d => d.folder === currentFolder).length} documents.</p>
                </div>
            )}
            
            {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-5 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'}`}>
                        {m.role === 'ai' ? (
                            <div className="prose prose-sm">
                                <Typewriter content={m.content} animate={i === chatMessages.length - 1} />
                            </div>
                        ) : (
                            <div className="prose prose-sm prose-invert"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                        )}
                    </div>
                    
                    {/* SOTA SOURCE GROUPING */}
                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-4 w-full animate-in fade-in slide-in-from-top-2 duration-500 space-y-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Quote size={10} /> Verified Sources</p>
                            
                            {/* Group by Source File */}
                            {groupCitations(m.citations).map((group, gIdx) => (
                                <div key={gIdx} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    {/* Group Header: File Link */}
                                    <Link href={group.docId ? `/chat/${group.docId}` : '#'} className="block bg-white border-b border-gray-100 px-3 py-2 hover:bg-blue-50 transition-colors group/header">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className="bg-blue-100 p-1 rounded text-blue-600"><FileText size={12}/></div>
                                                <span className="text-xs font-bold text-gray-700 truncate">{group.source}</span>
                                            </div>
                                            <ChevronRight size={14} className="text-gray-300 group-hover/header:text-blue-500 transition-colors"/>
                                        </div>
                                    </Link>
                                    
                                    {/* Quotes in this Group */}
                                    <div className="divide-y divide-gray-100">
                                        {group.quotes.slice(0, 3).map((cit, cIdx) => (
                                            <Link key={cIdx} href={group.docId ? `/chat/${group.docId}#page=${cit.page}` : '#'} className="block p-3 hover:bg-gray-100 transition-colors group/quote">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white border border-gray-200 px-1.5 rounded text-gray-500 group-hover/quote:border-blue-200 group-hover/quote:text-blue-500">P.{cit.page}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 italic line-clamp-2 border-l-2 border-transparent pl-2 group-hover/quote:border-blue-400 group-hover/quote:text-gray-900 transition-all">
                                                    "{cit.content}"
                                                </p>
                                            </Link>
                                        ))}
                                        {group.quotes.length > 3 && (
                                            <div className="p-2 text-center text-[10px] text-gray-400 font-medium italic">
                                                + {group.quotes.length - 3} more citations
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {isChatLoading && <div className="flex items-center gap-3 text-sm text-gray-500 animate-pulse"><div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"><Loader2 size={16} className="animate-spin"/></div><span>Analyzing documents...</span></div>}
        </div>

        <div className="p-6 bg-white border-t border-gray-100">
            <div className="flex gap-3 relative items-center max-w-4xl mx-auto">
                <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} disabled={isChatLoading} className={`p-4 rounded-2xl transition-all duration-200 ${isRecording ? 'bg-