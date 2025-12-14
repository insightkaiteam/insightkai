"use client";
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <h1 className="text-6xl font-bold text-black mb-4">InsightKai</h1>
      <p className="text-xl text-gray-500 mb-8">Your AI Research Assistant.</p>
      
      <Link href="/dashboard">
        <button className="px-8 py-4 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition">
          Go to Dashboard
        </button>
      </Link>
    </div>
  );
}