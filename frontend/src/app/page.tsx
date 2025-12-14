"use client";
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-6xl font-bold text-blue-600 mb-4">
        InsightKai
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Chat with your PDFs instantly.
      </p>
      
      <Link href="/chat">
        <button className="px-8 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition shadow-lg">
          Start Chatting
        </button>
      </Link>
    </div>
  );
}