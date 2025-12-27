"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Folder, FileText, Trash2, Plus, ArrowLeft, MessageSquare, 
  X, Send, Loader2, FileClock, BrainCircuit, UploadCloud, 
  LayoutGrid, LogOut, Quote, FileSearch, Mic, StopCircle 
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
  const [showChat, setShowChat] = useState(false);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<{role: string, content: string, citations?: any[]}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMode, setChatMode] = useState<'simple' | 'deep'>('simple'); 
  
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
  const sendFolderMessage = async () => {
    if (!chatInput.trim()) return;
    
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
      <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-8 gap-8 z-20">
        <Link href="/" className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-serif italic font-bold text-xl shadow-lg">κ</Link>
        <div className="flex flex-col gap-4">
            <button onClick={() => setCurrentFolder(null)} className={`p-3 rounded-xl transition ${!currentFolder ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}>
                <LayoutGrid size={24} />
            </button>
        </div>
        <div className="mt-auto">
            <button className="p-3 text-gray-400 hover:text-red-500 transition"><LogOut size={20} /></button>
        </div>
      </aside>

      {/* 2. MAIN CANVAS */}
      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-500 ${showChat ? 'mr-[400px]' : ''}`}>
        <div className="max-w-7xl mx-auto">
          
          {/* TOP BAR */}
          <header className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                  {currentFolder && (
                      <button onClick={() => setCurrentFolder(null)} className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-black rounded-full shadow-sm">
                          <ArrowLeft size={20} />
                      </button>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        {currentFolder || "My Library"}
                    </h1>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                        {currentFolder ? "Folder View" : "Dashboard"}
                    </p>
                  </div>
              </div>
              
              <div className="flex gap-3">
                  {!currentFolder ? (
                      <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-2 bg-white border border-gray-200 px-5 py-2.5 rounded-full hover:shadow-md transition text-sm font-bold">
                          <Plus size={16} /> New Folder
                      </button>
                  ) : (
                    <>
                      <button onClick={() => setShowChat(!showChat)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition text-sm font-bold border ${showChat ? 'bg-black text-white border-black' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                          <MessageSquare size={16} /> {showChat ? "Hide Chat" : "Folder Chat"}
                      </button>
                      <label className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full cursor-pointer hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm font-bold relative overflow-hidden">
                          {isUploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><UploadCloud size={16} /> Upload PDF</>}
                          <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading}/>
                      </label>
                    </>
                  )}
              </div>
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
              <div className="grid grid-cols-1 gap-4">
                  {docs.filter(doc => doc.folder === currentFolder).map((doc) => {
                      const { tag, desc } = parseSummary(doc.summary);
                      return (
                        <div key={doc.id} className="group bg-white p-5 rounded-3xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all flex justify-between items-start relative overflow-hidden">
                            {doc.status === 'processing' && <div className="absolute top-0 left-0 w-full h-1 bg-blue-100"><div className="h-full bg-blue-500 animate-progress origin-left"></div></div>}
                            
                            <div className="flex gap-5">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${doc.status === 'processing' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600'}`}>
                                    {doc.status === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-bold text-gray-900">{doc.title}</h3>
                                        {tag && <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border uppercase tracking-wider ${getTagColor(tag)}`}>{tag}</span>}
                                    </div>
                                    <p className="text-sm text-gray-500 leading-snug max-w-2xl">{desc}</p>
                                    <div className="flex gap-4 mt-3 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                        <span className="flex items-center gap-1"><FileClock size={10}/> {doc.upload_date}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {doc.status !== 'processing' && (
                                    <Link href={`/chat/${doc.id}`}>
                                        <button className="bg-black text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-gray-800 transition transform hover:scale-105">Open</button>
                                    </Link>
                                )}
                                <button onClick={(e) => handleDelete(doc.id, e)} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                            </div>
                        </div>
                      );
                  })}
                  
                  {docs.filter(doc => doc.folder === currentFolder).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400">
                          <UploadCloud size={40} className="mb-4 text-gray-300"/>
                          <p className="font-medium">No files yet.</p>
                      </div>
                  )}
              </div>
          )}
        </div>
      </main>

      {/* 3. RIGHT SIDEBAR (Chat) */}
      <aside className={`fixed top-0 right-0 h-full w-[400px] bg-white/90 backdrop-blur-2xl border-l border-gray-200 shadow-2xl z-30 transform transition-transform duration-500 ${showChat ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-lg">Folder Context</h2>
            <button onClick={() => setShowChat(false)} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20} className="text-gray-400"/></button>
        </div>

        <div className="p-4">
            <div className="bg-gray-100/50 p-1 rounded-xl flex gap-1">
                <button onClick={() => setChatMode('simple')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${chatMode === 'simple' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}>Fast</button>
                <button onClick={() => setChatMode('deep')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${chatMode === 'deep' ? 'bg-black text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}><BrainCircuit size={12}/> Deep</button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {chatMessages.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">Ask me anything about the files in this folder.</div>}
            
            {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 max-w-[90%] rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'}`}>
                        <div className={`prose prose-sm ${m.role === 'user' ? 'prose-invert' : ''}`}><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    </div>

                    {/* --- CITATION CARDS (FIXED: No line-clamp) --- */}
                    {m.role === 'ai' && m.citations && m.citations.length > 0 && (
                        <div className="mt-3 w-[90%] space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <Quote size={10} /> Verified Sources
                            </p>
                            {m.citations.slice(0, 3).map((cit: any, idx: number) => {
                                const docId = findDocIdByTitle(cit.source);
                                
                                const content = (
                                    <div className="bg-gray-50 hover:bg-blue-50/50 border border-gray-200 hover:border-blue-100 p-2.5 rounded-xl transition-all cursor-pointer group">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-[10px] text-blue-600 flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded">
                                                <FileSearch size={10} /> {cit.source}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-mono">Pg {cit.page}</span>
                                        </div>
                                        {/* FIXED: Removed line-clamp-2 so full quote shows */}
                                        <p className="text-xs text-gray-600 italic leading-relaxed">
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
            
            {isChatLoading && <div className="flex items-center gap-2 text-xs text-gray-400 px-4"><Loader2 size={12} className="animate-spin"/> AI is thinking...</div>}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white/50">
            <div className="flex gap-2 relative items-center">
                {/* NEW AUDIO BUTTON */}
                <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    disabled={isChatLoading}
                    className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200' : 'bg-white border border-gray-200 text-gray-400 hover:text-black hover:border-gray-300'}`}
                >
                    {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
                </button>

                <input className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" 
                    placeholder={isRecording ? "Listening..." : "Ask a question..."} 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && sendFolderMessage()} 
                    disabled={isRecording}
                />
                <button onClick={sendFolderMessage} className="absolute right-2 top-2 p-1.5 bg-black text-white rounded-xl hover:scale-95 transition"><Send size={16}/></button>
            </div>
        </div>
      </aside>

    </div>
  );
}