"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ⚠️ REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 

export default function Dashboard() {
  const [docs, setDocs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => { fetchDocuments(); }, []);

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
      await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: formData });
      await fetchDocuments(); 
    } catch (error) { alert("Upload failed"); } 
    finally { setIsUploading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Your Library</h1>
        <label className="bg-black text-white px-6 py-3 rounded-lg cursor-pointer">
          {isUploading ? "Processing..." : "+ Upload PDF"}
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
        {docs.length === 0 && <p className="text-gray-400">No documents found. Upload one!</p>}
      </div>
    </div>
  );
}