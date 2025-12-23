"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Folder, FileText, Trash2, Plus, ArrowLeft, MessageSquare, X, Send, Loader2, FileClock, BrainCircuit, Tag } from 'lucide-react';
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
    
    // We expect format: [TAG]: ... \n [DESC]: ...
    const tagMatch = rawSummary.match(/\[TAG\]:\s*(.*?)(?=\n|\[|$)/i);
    const descMatch = rawSummary.match(/\[DESC\]:\s*(.*?)(?=\n|\[|$)/i);
    
    // Fallback: If no structured tag found, don't show garbage
    if (!tagMatch && !descMatch) return { tag: null, desc: null };

    return {
      tag: tagMatch ? tagMatch[1].trim().toUpperCase() : "FILE",
      desc: descMatch ? descMatch[1].trim() : "No description available."
    };
  };

  // --- COLOR HELPER FOR TAGS ---
  const getTagColor = (tag: string) => {
    const colors: {[key: string]: string} = {
      'INVOICE': 'bg-red-100 text-red-700 border-red-200',
      'RESEARCH': 'bg-purple-100 text-purple-700 border-purple-200',
      'FINANCIAL': 'bg-green-100 text-green-700 border-green-200',
      'LEGAL': 'bg-blue-100 text-blue-700 border-blue-200',
      'RECEIPT': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'OTHER': 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return colors[tag] || colors['OTHER'];
  };

  // 1. Initial Load
  useEffect(() => { 
    if (localStorage.getItem('auth_token') === SITE_PASSWORD) {
        setIsAuthenticated(true);
        refreshData();
    }
  }, []);

  // 2. POLLING LOGIC
  useEffect(() => {
    const processingDocs = docs.filter(d => d.status === 'processing');
    if (processingDocs.length > 0) {
        const interval = setInterval(() => {
            console.log("Polling for updates...");
            refreshData();
        }, 3000);
        return () => clearInterval(interval);
    }
  }, [docs]);

  const refreshData = async () => {
    try {
        const resFolders = await fetch(`${BACKEND_URL}/folders`);
        const dataFolders = await resFolders.json();
        setFolders(dataFolders.folders || ["General"]);

        const resDocs = await fetch(`${BACKEND_URL}/documents`);
        const dataDocs = await resDocs.json();
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
    if (!confirm(`Are you sure you want to delete folder "${folderName}"? Documents inside will be moved to 'General'.`)) return;
    try {
        const res = await fetch(`${BACKEND_URL}/folders/${folderName}`, { method: 'DELETE' });
        if (res.ok) refreshData();
        else alert("Failed to delete folder");
    } catch (e) { alert("Error deleting folder"); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    formData.append('folder', currentFolder || "General");

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        alert(`Upload Failed: ${err.detail}`);
      } else {
        await refreshData();
      }
    } catch (error) { alert("Upload failed."); } 
    finally { setIsUploading(false); }
  };

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if(!confirm("Are you sure you want to delete this file?")) return;
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
        body: JSON.stringify({ 
            message: msgToSend, 
            folder_name: currentFolder,
            mode: chatMode 
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "Error: Could not reach backend." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-center">InsightKai Locked</h2>
                <input type="password" className="w-full border p-3 rounded-lg mb-4" placeholder="Enter Password"
                    value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                <button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-lg font-bold">Unlock</button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      <div className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${showChat ? 'mr-96' : ''}`}>
        <div className="max-w-6xl mx-auto">
          
          {/* HEADER */}
          <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                  {currentFolder && (
                      <button onClick={() => setCurrentFolder(null)} className="p-2 hover:bg-gray-200 rounded-full transition">
                          <ArrowLeft size={24} />
                      </button>
                  )}
                  <h1 className="text-3xl font-bold text-gray-900">
                      {currentFolder ? currentFolder : "Your Library"}
                  </h1>
              </div>
              
              <div className="flex gap-3">
                  {!currentFolder && (
                      <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100">
                          <Plus size={18} /> New Folder
                      </button>
                  )}

                  {currentFolder && (
                    <>
                      <button 
                        onClick={() => setShowChat(!showChat)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${showChat ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100'}`}
                      >
                          <MessageSquare size={18} /> {showChat ? "Close Chat" : "Chat with Folder"}
                      </button>

                      <label className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-800 transition">
                          <Plus size={18} /> {isUploading ? "Uploading..." : "Upload PDF"}
                          <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading}/>
                      </label>
                    </>
                  )}
              </div>
          </div>

          {showNewFolderInput && (
              <div className="mb-8 flex gap-2">
                  <input className="border p-2 rounded-lg w-64" placeholder="Folder Name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                  <button onClick={handleCreateFolder} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Create</button>
                  <button onClick={() => setShowNewFolderInput(false)} className="text-gray-500 px-4">Cancel</button>
              </div>
          )}

          {/* FOLDER GRID */}
          {!currentFolder && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {folders.map(folder => (
                      <div key={folder} onClick={() => setCurrentFolder(folder)} 
                           className="group bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col items-center gap-3 relative">
                          <Folder size={48} className="text-blue-500 fill-blue-50" />
                          <h3 className="font-semibold text-lg">{folder}</h3>
                          <p className="text-sm text-gray-400">{docs.filter(d => d.folder === folder).length} files</p>
                          {folder !== "General" && (
                              <button onClick={(e) => handleDeleteFolder(folder, e)} className="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                  <Trash2 size={18} />
                              </button>
                          )}
                      </div>
                  ))}
              </div>
          )}

          {/* FILE LIST */}
          {currentFolder && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-1 divide-y">
                      {docs.filter(doc => doc.folder === currentFolder).map((doc) => {
                          // PARSE THE SUMMARY TO GET TAGS
                          const { tag, desc } = parseSummary(doc.summary);
                          
                          return (
                            <div key={doc.id} className="p-4 flex justify-between items-start hover:bg-gray-50 transition">
                                <div className="flex items-start gap-4">
                                    <div className={`p-2 rounded-lg mt-1 ${doc.status === 'processing' ? 'bg-yellow-50' : 'bg-red-50'}`}>
                                        {doc.status === 'processing' ? <Loader2 className="text-yellow-600 animate-spin" size={24} /> : <FileText className="text-red-500" size={24} />}
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold text-gray-900 text-lg">{doc.title}</h3>
                                            
                                            {/* --- THE TAG BADGE --- */}
                                            {tag && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getTagColor(tag)}`}>
                                                    {tag}
                                                </span>
                                            )}
                                        </div>

                                        {/* --- THE 1-SENTENCE DESCRIPTION --- */}
                                        {desc && (
                                            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                                                {desc}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                                            {doc.status === 'processing' && <span className="text-yellow-600 font-bold">PROCESSING...</span>}
                                            {doc.status === 'failed' && <span className="text-red-600 font-bold">FAILED</span>}
                                            <FileClock size={12}/> <span>{doc.upload_date}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-1">
                                    {doc.status !== 'processing' && (
                                        <Link href={`/chat/${doc.id}`}>
                                            <button className="bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Open & Chat</button>
                                        </Link>
                                    )}
                                    <button onClick={(e) => handleDelete(doc.id, e)} className="p-2 text-gray-400 hover:text-red-600 transition">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                          );
                      })}
                      {docs.filter(doc => doc.folder === currentFolder).length === 0 && (
                          <div className="p-10 text-center text-gray-400">This folder is empty. Upload a PDF to start.</div>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: FOLDER CHAT */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 flex flex-col ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
            <div>
                <h2 className="font-bold text-lg">Chat with Folder</h2>
                <p className="text-xs text-gray-400">{currentFolder}</p>
            </div>
            <button onClick={() => setShowChat(false)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setChatMode('simple')} className={`flex-1 py-1 text-xs font-semibold rounded-md transition ${chatMode === 'simple' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>Fast Search</button>
                <button onClick={() => setChatMode('deep')} className={`flex-1 py-1 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1 ${chatMode === 'deep' ? 'bg-purple-600 text-white shadow' : 'text-gray-500'}`}><BrainCircuit size={12} /> Deep Compare</button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">{chatMode === 'simple' ? "Best for finding specific files or facts." : "Reads 5x more data. Good for summaries."}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {chatMessages.length === 0 && <p className="text-gray-400 text-center mt-10 text-sm">Ask questions across all files in this folder.</p>}
            {chatMessages.map((m, i) => (
                <div key={i} className={`p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-10' : 'bg-white border text-gray-800 mr-10'}`}>
                    {m.role === 'ai' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                </div>
            ))}
            {isChatLoading && <div className="text-gray-400 text-xs animate-pulse">Thinking...</div>}
        </div>

        <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
                <input className="flex-1 border p-2 rounded-lg text-sm" placeholder="Ask something..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendFolderMessage()} />
                <button onClick={sendFolderMessage} className="bg-black text-white p-2 rounded-lg"><Send size={18} /></button>
            </div>
        </div>
      </div>
    </div>
  );
}