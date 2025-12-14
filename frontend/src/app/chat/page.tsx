"use client";
import { useState } from 'react';

export default function Chat() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ⚠️ REPLACE THIS WITH YOUR ACTUAL RENDER URL ⚠️
  // Make sure there is NO trailing slash at the end.
  // Example: "https://insightkai-backend.onrender.com"
  const BACKEND_URL = "https://insightkai.onrender.com"; 

  const sendMessage = async () => {
    if (!input.trim()) return;

    // 1. Add User Message to UI immediately
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentMessage = input; // Save it before clearing
    setInput('');
    setIsLoading(true);

    try {
      // 2. Send to Python Backend
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentMessage }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      // 3. Add AI Response to UI
      // Our backend returns { "answer": "..." }
      setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);

    } catch (error) {
      console.error("Error connecting to backend:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "⚠️ Error: Could not connect to the backend. Is it running?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* LEFT SIDE: PDF Viewer Placeholder */}
      <div className="w-1/2 bg-gray-800 text-white flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-2xl font-bold mb-2">PDF Viewer Area</h2>
        <p className="text-gray-400">
          (We will implement the real PDF upload & viewer here in the next step)
        </p>
      </div>

      {/* RIGHT SIDE: Chat Interface */}
      <div className="w-1/2 flex flex-col bg-white">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 shadow-sm">
          <h1 className="font-semibold text-gray-700">Chat with InsightKai</h1>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-20">
              <p>No messages yet. Say hello!</p>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
              }`}>
                <strong>{m.role === 'user' ? 'You' : 'AI'}:</strong> {m.content}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 p-3 rounded-lg rounded-bl-none text-sm italic animate-pulse">
                AI is thinking...
              </div>
            </div>
          )}
        </div>
        
        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <input 
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={isLoading}
            />
            <button 
              onClick={sendMessage} 
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg font-medium text-white transition ${
                isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}