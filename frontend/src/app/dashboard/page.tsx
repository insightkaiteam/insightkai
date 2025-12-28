"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Folder, FileText, Trash2, Plus, ArrowLeft, 
  X, Send, Loader2, FileClock, BrainCircuit, UploadCloud, 
  LayoutGrid, LogOut, Quote, FileSearch, Mic, StopCircle, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ⚠️ REPLACE WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com";
const SITE_PASSWORD = "kai2025"; 

// Helper interface for documents
interface Doc {
  id: string;
  title: string;
  folder: string;
  status: string;
  summary: string;
  upload_date: string;
}

export default function Dashboard() {
  const [folders, setFolders] = useState<string[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  
  // --- CHAT STATE ---
  // Replaced showChat boolean with a tri-state mode
  const [chatMode, setChatMode] = useState<'simple' | 'deep' | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const parseSummary = (rawSummary: string) => {
    if (!rawSummary) return { tag: null, desc: null };
    const tagMatch = rawSummary.match(/\[TAG\]:\s*(.*?)(?=\n|\[|$)/i);
    const descMatch = rawSummary.match(/\[DESC\]:\s*(.*?)(?=\n|\[|$)/i);
    if (!tagMatch && !descMatch) return { tag: null, desc: null };
    return {
      tag: tagMatch ? tagMatch[1].trim().toUpperCase() : "FILE",
      desc: descMatch ? descMatch[1].trim() : "No description available."
    };
  };

  const getTagColor = (tag: string) => {
    const colors: {[key: string]: string} = {
      'INVOICE': 'bg-rose-50 text-rose-600 border-rose-200 ring-rose-500/10',
      'RESEARCH': 'bg-purple-50 text-purple-600 border-purple-200 ring-purple-500/10',
      'FINANCIAL': 'bg-emerald-50 text-emerald-600 border-emerald-200 ring-emerald-500/10',
      'LEGAL': 'bg-blue-50 text-blue-600 border-blue-200 ring-blue-500/10',
      'RECEIPT': 'bg-amber-50 text-amber-600 border-amber-200 ring-amber-500/10',
      'OTHER': 'bg-gray-50 text-gray-600 border-gray-200 ring-gray-500/10'
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
        const dataFolders = await resFolders.json();
        const dataDocs = await resDocs.json();
        setFolders(dataFolders.folders || ["General"]);
        setDocs(dataDocs.documents || []);
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
    try {
        const res = await fetch(`${BACKEND_URL}/folders/${folderName}`, { method: 'DELETE' });
        if (res.ok) refreshData();
    } catch (e) { alert("Error"); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    formData.append('folder', currentFolder || "General");
    try {
      await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData });
      await refreshData();
    } catch (error) { alert("Upload failed."); } 
    finally { setIsUploading(false); }
  };

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if(!confirm("Delete this file?")) return;
    try {
        await fetch(`${BACKEND_URL}/documents/${docId}`, { method: 'DELETE' });
        refreshData();
    } catch(e) { alert("Delete failed"); }
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
        
        setChatInput("Transcribing...");
        try {
          const res = await fetch(`${BACKEND_URL}/transcribe`, {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          setChatInput(data.text);
        } catch (e) {
          alert("Transcription failed");
          setChatInput("");
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Microphone access denied", e);
      alert("Microphone access denied. Please check permissions.");
    }
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
    if (chatMode === mode) {
        setChatMode(null); // Toggle off if clicking same button
    } else {
        setChatMode(mode);
        // Clear history if switching modes? Optional. Let's keep context for now or clear it.
        // setChatMessages([]); // Uncomment to clear chat on mode switch
    }
  };

  const sendFolderMessage = async () => {
    if (!chatInput.trim()) return;
    if (!chatMode) return; // Should not happen
    
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    
    const msgToSend = chatInput;
    setChatInput("");
    setIsChatLoading(true);
    
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgToSend, folder_name: currentFolder, mode: chatMode }),
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

  const findDocIdByTitle = (title: string) => {
    const found = docs.find(d => d.title === title);
    return found ? found.id : null;
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
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden font-sans text-gray-900">
      
      {/* 1. SIDEBAR NAVIGATION */}
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

      {/* 2. SPLIT VIEW CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL: FILE LIST */}
        <main className={`flex flex-col transition-all duration-500 ease-in-out ${chatMode ? 'w-1/3 min-w-[320px] border-r border-gray-200' : 'w-full'}`}>
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-7xl mx-auto">
                    
                    {/* TOP BAR */}
                    <header className="flex flex-col gap-6 mb-10">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                {currentFolder && (
                                    <button onClick={() => { setCurrentFolder(null); setChatMode(null); }} className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-black rounded-full shadow-sm">
                                        <ArrowLeft size={20} />
                                    </button>
                                )}
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 line-clamp-1">
                                        {currentFolder || "My Library"}
                                    </h1>
                                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                                        {currentFolder ? (chatMode ? "Context View" : "Folder View") : "Dashboard"}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                {!currentFolder && (
                                    <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-2 bg-white border border-gray-200 px-5 py-2.5 rounded-full hover:shadow-md transition text-sm font-bold">
                                        <Plus size={16} /> New Folder
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* SEPARATED CHAT OPTIONS & UPLOAD (Only in Folder View) */}
                        {currentFolder && (
                            <div className="flex flex-wrap gap-3">
                                <button 
                                    onClick={() => toggleChat('simple')} 
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition text-sm font-bold border shadow-sm ${chatMode === 'simple' ? 'bg-black text-white border-black ring-2 ring-black/20' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <Zap size={16} className={chatMode === 'simple' ? "fill-white" : "fill-none"} /> Fast Chat
                                </button>
                                <button 
                                    onClick={() => toggleChat('deep')} 
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition text-sm font-bold border shadow-sm ${chatMode === 'deep' ? 'bg-black text-white border-black ring-2 ring-black/20' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <BrainCircuit size={16} /> Deep Chat
                                </button>
                                
                                <label className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl cursor-pointer hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm font-bold relative overflow-hidden min-w-[140px]">
                                    {isUploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><UploadCloud size={16} /> Upload PDF</>}
                                    <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading}/>
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

                    {/* FOLDER CARDS */}
                    {!currentFolder && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {folders.map(folder => (
                                <div key={folder} onClick={() => setCurrentFolder(folder)} 
                                    className="group bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition"></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                                            <Folder size={24} fill="currentColor" className="text-gray-300 group-hover:text-blue-200" />
                                        </div>
                                        {folder !== "General" && (
                                            <button onClick={(e) => handleDeleteFolder(folder, e)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-900 mb-1">{folder}</h3>
                                    <p className="text-xs text-gray-400 font-medium">{docs.filter(d => d.folder === folder).length} items</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DOCUMENT LIST */}
                    {currentFolder && (
                        // Dynamic Grid: 1 column if chat is open, multiple if closed
                        <div className={`grid gap-4 ${chatMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                            {docs.filter(doc => doc.folder === currentFolder).map((doc) => {
                                const { tag, desc } = parseSummary(doc.summary);
                                return (
                                    <div key={doc.id} className="group bg-white p-5 rounded-3xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex justify-between items-start relative overflow-hidden">
                                        {doc.status === 'processing' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-100"><div className="h-full bg-blue-500 animate-progress origin-left"></div></div>}
                                        
                                        <div className="flex gap-4 w-full">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${doc.status === 'processing' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600'}`}>
                                                {doc.status === 'processing' ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className="font-bold text-gray-900 truncate">{doc.title}</h3>
                                                    {tag && <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border uppercase tracking-wider ${getTagColor(tag)}`}>{tag}</span>}
                                                </div>
                                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{desc}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {doc.status !== 'processing' && (
                                                <Link href={`/chat/${doc.id}`}>
                                                    <button className="bg-black text-white p-2 rounded-lg shadow-lg hover:bg-gray-800 transition transform hover:scale-105"><ArrowLeft size={14} className="rotate-180"/></button>
                                                </Link>
                                            )}
                                            <button onClick={(e) => handleDelete(doc.id, e)} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={14}/></button>
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
        </main>

        {/* RIGHT PANEL: CHAT INTERFACE (Takes remaining space) */}
        {chatMode && (
            <div className="flex-1 bg-white/50 backdrop-blur-xl border-l border-gray-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right-10 duration-500">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/80">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-md ${chatMode === 'simple' ? 'bg-black' : 'bg-gradient-to-br from-blue-600 to-purple-600'}`}>
                            {chatMode === 'simple' ? <Zap size={16} /> : <BrainCircuit size={16} />}
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-tight">{chatMode === 'simple' ? "Fast Folder Chat" : "Deep Folder Chat"}</h2>
                            <p className="text-xs text-gray-400 font-medium">{chatMode === 'simple' ? "Instant answers from summaries" : "Detailed analysis across all files"}</p>
                        </div>
                    </div>
                    <button onClick={() => setChatMode(null)} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20} className="text-gray-400"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
                    {chatMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                            {chatMode === 'simple' ? <Zap size={48} className="mb-4 text-gray-300"/> : <BrainCircuit size={48} className="mb-4 text-gray-300"/>}
                            <p className="font-medium text-gray-500">Ready to analyze {docs.filter(d => d.folder === currentFolder).length} documents.</p>
                        </div>
                    )}
                    
                    {chatMessages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-5 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'}`}>
                                <div className={`prose prose-sm ${m.role === 'user' ? 'prose-invert' : ''}`}><ReactMarkdown>{m.content}</ReactMarkdown></div>
                            </div>

                            {/* CITATION CARDS */}
                            {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                                <div className="mt-4 w-[85%] grid grid-cols-1 gap-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <Quote size={10} /> Verified Sources
                                    </p>
                                    {m.citations.slice(0, 3).map((cit: any, idx: number) => {
                                        const docId = findDocIdByTitle(cit.source);
                                        const content = (
                                            <div className="bg-white/50 hover:bg-blue-50/50 border border-gray-200 hover:border-blue-200 p-3 rounded-xl transition-all cursor-pointer group shadow-sm hover:shadow-md">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-[10px] text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                        <FileSearch size={10} /> {cit.source}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">Page {cit.page}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 italic leading-relaxed pl-2 border-l-2 border-gray-300 group-hover:border-blue-400 transition-colors">
                                                    "{cit.content}"
                                                </p>
                                            </div>
                                        );

                                        if (docId) {
                                            return (
                                                <Link 
                                                    key={idx} 
                                                    href={`/chat/${docId}#page=${cit.page}&:~:text=${encodeURIComponent(cit.content.substring(0,300))}`}
                                                    className="block"
                                                >
                                                    {content}
                                                </Link>
                                            );
                                        }
                                        return <div key={idx}>{content}</div>;
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isChatLoading && (
                        <div className="flex items-center gap-3 text-sm text-gray-500 animate-pulse">
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center"><Loader2 size={16} className="animate-spin"/></div>
                            <span>Analyzing documents...</span>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white border-t border-gray-100">
                    <div className="flex gap-3 relative items-center max-w-4xl mx-auto">
                        <button
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            disabled={isChatLoading}
                            className={`p-4 rounded-2xl transition-all duration-200 ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200 ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-black hover:text-white'}`}
                        >
                            {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
                        </button>

                        <div className="flex-1 relative">
                            <input 
                                className="w-full bg-gray-100 border-none rounded-2xl py-4 pl-6 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 placeholder:text-gray-400 transition-all" 
                                placeholder={isRecording ? "Listening..." : `Ask ${chatMode === 'simple' ? 'Fast' : 'Deep'} Chat...`}
                                value={chatInput} 
                                onChange={e => setChatInput(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && sendFolderMessage()} 
                                disabled={isRecording}
                            />
                            <button onClick={sendFolderMessage} className="absolute right-2 top-2 p-2 bg-white text-black rounded-xl hover:scale-110 shadow-sm transition"><Send size={18}/></button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}