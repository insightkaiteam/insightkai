"use client";
import { useState } from 'react';

export default function Chat() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');

  // This currently talks to a fake backend. We will connect it to Render in Phase 2.
  const sendMessage = async () => {
    if (!input) return;
    
    const newMsg = { role: 'user', content: input };
    setMessages([...messages, newMsg]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content: "I am a skeleton AI. Connect me to Python!" }]);
    }, 1000);
  };

  return (
    <div className="flex h-screen">
      {/* Left: PDF Placeholder */}
      <div className="w-1/2 bg-gray-800 text-white flex items-center justify-center">
        <h2>PDF Viewer Area</h2>
      </div>

      {/* Right: Chat */}
      <div className="w-1/2 flex flex-col p-4 bg-white">
        <div className="flex-1 overflow-y-auto mb-4 border p-2 rounded bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`p-2 my-2 rounded ${m.role === 'user' ? 'bg-blue-100 self-end text-right' : 'bg-gray-200'}`}>
              <strong>{m.role === 'user' ? 'You' : 'AI'}:</strong> {m.content}
            </div>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input 
            className="border p-2 flex-1 rounded"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage} className="bg-blue-600 text-white p-2 rounded">Send</button>
        </div>
      </div>
    </div>
  );
}