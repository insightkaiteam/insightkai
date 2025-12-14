"use client";
import { useState, use } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// ⚠️ REPLACE THIS WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com"; 

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentMessage = input;
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentMessage, document_id: docId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error: Backend not reachable." }]);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      
      {/* LEFT SIDE: Real PDF Viewer (Fixed: Removed duplicate container) */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700">
        <iframe
          src={`${BACKEND_URL}/documents/${docId}/download`}
          className="w-full h-full"
          title="PDF Viewer"
        />
      </div>

      {/* RIGHT SIDE: Chat */}
      <div className="w-1/2 flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-lg max-w-[90%] ${m.role === 'user' ? 'bg-blue-100 self-end ml-auto' : 'bg-gray-100'}`}>
              {m.role === 'ai' ? (
                  <div className="prose text-sm">
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
            </div>
          ))}
          {isLoading && <p className="text-gray-400 p-4">Thinking...</p>}
        </div>
        
        <div className="p-4 border-t flex gap-2">
          <input className="flex-1 border p-2 rounded" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMessage()}/>
          <button onClick={sendMessage} className="bg-black text-white px-4 rounded">Send</button>
        </div>
      </div>
    </div>
  );
}