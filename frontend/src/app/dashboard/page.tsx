"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Folder, FileText, Trash2, Plus, ArrowLeft, MessageSquare, X, Send, Loader2, FileClock, BrainCircuit, Search, UploadCloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ⚠️ REPLACE WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com";
const SITE_PASSWORD = "kai2025"; 

export default function Dashboard() {
  // Data State
  const [folders, setFolders] = useState<string[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  
  // UI State
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMode, setChatMode] = useState<'simple' | 'deep'>('simple'); 

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // --- HELPER: Parse the AI Summary ---
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

  // --- COLOR HELPER FOR TAGS (Subtle Pastels) ---
  const getTagColor = (tag: string) => {
    const colors: {[key: string]: string} = {
      'INVOICE': 'bg-rose-50 text-rose-600 border-rose-100',
      'RESEARCH': 'bg-violet-50 text-violet-600 border-violet-100',
      'FINANCIAL': 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'LEGAL': 'bg-blue-50 text-blue-600 border-blue-100',
      'RECEIPT': 'bg-amber-50 text-amber-600 border-amber-100',
      'OTHER': 'bg-slate-50 text-slate-500 border-slate-100'
    };
    return colors[tag] || colors['OTHER'];
  };

  // Initial Load & Polling
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
    if (!confirm(`Are you sure you want to delete folder "${folderName}"?`)) return;
    try {
        const res = await fetch(`${BACKEND_URL}/folders/${folderName}`, { method: 'DELETE' });
        if (res.ok) refreshData();
    } catch (e) { alert("Error deleting folder"); }
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
      setChatMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "Error: Could not reach backend." }]);
    } finally { setIsChatLoading(false); }
  };

  if (!isAuthenticated) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-10 rounded-3xl shadow-xl shadow-gray-200/50 w-full max-w-sm border border-gray-100 text-center">
                <div className="mb-6 bg-black text-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto shadow-lg">
                    <BrainCircuit size={24} />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-gray-900 tracking-tight">Welcome Back</h2>
                <p className="text-gray-500 mb-6 text-sm">Enter your access key to continue</p>
                <input type="password" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 focus:ring-2 focus:ring-black/5 focus:outline-none transition-all" placeholder="Password"
                    value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                <button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all shadow-lg shadow-gray-200">Unlock</button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden font-sans text-gray-900">
      
      <div className={`flex-1 p-8 overflow-y-auto transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] ${showChat ? 'mr-[400px]' : ''}`}>
        <div className="max-w-7xl mx-auto">
          
          {/* HEADER */}
          <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                  {currentFolder && (
                      <button onClick={() => setCurrentFolder(null)} className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-black rounded-full transition-all shadow-sm hover:shadow-md">
                          <ArrowLeft size={20} />
                      </button>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        {currentFolder ? currentFolder : "Library"}
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        {currentFolder ? "Manage and chat with files in this folder" : "Select a folder to get started"}
                    </p>
                  </div>
              </div>
              
              <div className="flex gap-3">
                  {!currentFolder && (
                      <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-full hover:bg-gray-50 hover:shadow-md transition-all font-medium text-sm">
                          <Plus size={18} /> New Folder
                      </button>
                  )}

                  {currentFolder && (
                    <>
                      <button 
                        onClick={() => setShowChat(!showChat)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-medium text-sm shadow-sm ${showChat ? 'bg-black text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      >
                          <MessageSquare size={18} /> {showChat ? "Close Chat" : "Chat with Folder"}
                      </button>

                      <label className="group relative flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full cursor-pointer hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl font-medium text-sm overflow-hidden">
                          {isUploading ? (
                              <div className="flex items-center gap-2">
                                  <Loader2 size={18} className="animate-spin" /> Uploading...
                                  {/* Loading Bar Animation */}
                                  <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full">
                                    <div className="h-full bg-white/50 animate-progress w-full origin-left"></div>
                                  </div>
                              </div>
                          ) : (
                              <><UploadCloud size={18} /> Upload PDF</>
                          )}
                          <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading}/>
                      </label>
                    </>
                  )}
              </div>
          </div>

          {showNewFolderInput && (
              <div className="mb-8 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                  <input className="border border-gray-200 p-3 rounded-xl w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5" placeholder="Folder Name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
                  <button onClick={handleCreateFolder} className="bg-black text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all">Create</button>
                  <button onClick={() => setShowNewFolderInput(false)} className="text-gray-500 px-4 hover:text-black transition-colors">Cancel</button>
              </div>
          )}

          {/* FOLDER GRID */}
          {!currentFolder && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {folders.map(folder => (
                      <div key={folder} onClick={() => setCurrentFolder(folder)} 
                           className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center gap-4 relative">
                          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300">
                            <Folder size={32} fill="currentColor" className="text-blue-500/20" />
                          </div>
                          <div className="text-center">
                            <h3 className="font-bold text-gray-900">{folder}</h3>
                            <p className="text-xs text-gray-400 mt-1 font-medium">{docs.filter(d => d.folder === folder).length} files</p>
                          </div>
                          {folder !== "General" && (
                              <button onClick={(e) => handleDeleteFolder(folder, e)} className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                  <Trash2 size={16} />
                              </button>
                          )}
                      </div>
                  ))}
              </div>
          )}

          {/* FILE LIST */}
          {currentFolder && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="grid grid-cols-1 divide-y divide-gray-50">
                      {docs.filter(doc => doc.folder === currentFolder).map((doc) => {
                          const { tag, desc } = parseSummary(doc.summary);
                          return (
                            <div key={doc.id} className="group p-6 flex justify-between items-start hover:bg-gray-50/80 transition-colors duration-200">
                                <div className="flex items-start gap-5">
                                    <div className={`p-3 rounded-2xl mt-1 shadow-sm ${doc.status === 'processing' ? 'bg-amber-50 text-amber-600' : 'bg-white border border-gray-100 text-gray-700'}`}>
                                        {doc.status === 'processing' ? <Loader2 className="animate-spin" size={24} /> : <FileText size={24} />}
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-gray-900 text-lg tracking-tight group-hover:text-blue-600 transition-colors">{doc.title}</h3>
                                            {tag && <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide ${getTagColor(tag)}`}>{tag}</span>}
                                        </div>

                                        {desc && <p className="text-sm text-gray-500 mt-1.5 max-w-2xl leading-relaxed">{desc}</p>}

                                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-3 font-medium">
                                            {doc.status === 'processing' && <span className="flex items-center gap-1 text-amber-600"><Loader2 size={10} className="animate-spin"/> Processing</span>}
                                            {doc.status === 'failed' && <span className="text-red-500">Failed</span>}
                                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md"><FileClock size={12}/> {doc.upload_date}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    {doc.status !== 'processing' && (
                                        <Link href={`/chat/${doc.id}`}>
                                            <button className="bg-black text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5">Open</button>
                                        </Link>
                                    )}
                                    <button onClick={(e) => handleDelete(doc.id, e)} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-100 rounded-xl transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                          );
                      })}
                      {docs.filter(doc => doc.folder === currentFolder).length === 0 && (
                          <div className="p-16 text-center">
                              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                  <UploadCloud size={32} />
                              </div>
                              <h3 className="text-gray-900 font-bold text-lg">Empty Folder</h3>
                              <p className="text-gray-400 text-sm mt-1">Upload a PDF to get started.</p>
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: FOLDER CHAT */}
      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white/80 backdrop-blur-xl border-l border-gray-200 transform transition-transform duration-500 cubic-bezier(0.25, 0.8, 0.25, 1) flex flex-col shadow-2xl z-50 ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/50">
            <div>
                <h2 className="font-bold text-xl text-gray-900 tracking-tight">Folder Chat</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{currentFolder}</p>
            </div>
            <button onClick={() => setShowChat(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* CHAT MODE TOGGLE */}
        <div className="px-6 py-4 bg-white/30 border-b border-gray-100">
            <div className="flex bg-gray-100/80 p-1 rounded-xl">
                <button onClick={() => setChatMode('simple')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${chatMode === 'simple' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}>Fast Search</button>
                <button onClick={() => setChatMode('deep')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${chatMode === 'deep' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}><BrainCircuit size={14} /> Deep Compare</button>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center font-medium uppercase tracking-wider">
                {chatMode === 'simple' ? "Finds specific files & facts" : "Analyzes & compares multiple docs"}
            </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {chatMessages.length === 0 && (
                <div className="text-center mt-10 opacity-50">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Search size={20} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">Ask about any file in this folder.</p>
                </div>
            )}
            {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-4 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${
                        m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm'
                    }`}>
                        <ReactMarkdown className="prose prose-sm prose-invert">{m.content}</ReactMarkdown>
                    </div>
                </div>
            ))}
            {isChatLoading && (
                <div className="flex justify-start">
                    <div className="bg-gray-50 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-2 items-center text-xs text-gray-400 font-medium">
                        <Loader2 size={12} className="animate-spin" /> Thinking...
                    </div>
                </div>
            )}
        </div>

        <div className="p-5 bg-white/50 border-t border-gray-100 backdrop-blur-sm">
            <div className="flex gap-2 relative">
                <input 
                    className="flex-1 bg-gray-50 border border-gray-200 p-3.5 pl-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 transition-all shadow-inner" 
                    placeholder="Ask a question..." 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && sendFolderMessage()} 
                />
                <button onClick={sendFolderMessage} className="absolute right-2 top-2 bg-black text-white p-2 rounded-xl hover:bg-gray-800 transition-colors shadow-md">
                    <Send size={16} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}