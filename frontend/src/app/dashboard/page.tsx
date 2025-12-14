"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ⚠️ REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 
const SITE_PASSWORD = "kai2025"; // <--- SET YOUR PASSWORD HERE

export default function Dashboard() {
  const [docs, setDocs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // --- PASSWORD STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => { 
    // Check if user already logged in previously
    if (localStorage.getItem('auth_token') === SITE_PASSWORD) {
        setIsAuthenticated(true);
        fetchDocuments(); 
    }
  }, []);

  const handleLogin = () => {
    if (passwordInput === SITE_PASSWORD) {
        localStorage.setItem('auth_token', SITE_PASSWORD);
        setIsAuthenticated(true);
        fetchDocuments();
    } else {
        alert("Incorrect Password");
    }
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/documents`);
      const data = await res.json();
      if(data.documents) setDocs(data.documents);
    } catch (e) { console.error(e); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData });
      
      if (!res.ok) {
        // Handle the Page Limit Error
        const errorData = await res.json();
        alert(`Upload Failed: ${errorData.detail}`); // "Page limit exceeded..."
        setIsUploading(false);
        return;
      }

      await fetchDocuments(); 
    } catch (error) { 
        alert("Upload failed. Is server running?"); 
    } finally { setIsUploading(false); }
  };

  // --- PASSWORD SCREEN ---
  if (!isAuthenticated) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-center">InsightKai Locked</h2>
                <p className="mb-4 text-gray-500 text-center text-sm">Please enter the password to access.</p>
                <input 
                    type="password" 
                    className="w-full border p-3 rounded-lg mb-4" 
                    placeholder="Enter Password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                />
                <button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-lg font-bold">
                    Unlock
                </button>
            </div>
        </div>
    );
  }

  // --- MAIN DASHBOARD (Only shown if authenticated) ---
  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Your Library</h1>
        <label className="bg-black text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-gray-800 transition">
          {isUploading ? "Checking Limit..." : "+ Upload PDF"}
          <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} disabled={isUploading}/>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {docs.map((doc) => (
          <div key={doc.id} className="bg-white p-6 rounded-xl shadow-sm border flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">{doc.title}</h3>
              <p className="text-gray-500 text-sm">{doc.page_count} pages • {doc.upload_date}</p>
            </div>
            <Link href={`/chat/${doc.id}`}>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">Chat</button>
            </Link>
          </div>
        ))}
        {docs.length === 0 && <p className="text-gray-400">No documents found.</p>}
      </div>
    </div>
  );
}