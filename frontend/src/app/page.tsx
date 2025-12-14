"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-50">
      <h1 className="text-6xl font-bold text-blue-600">
        InsightKai
      </h1>
      <p className="mt-4 text-2xl text-gray-600">
        Chat with your PDFs instantly.
      </p>
      
      <div className="mt-8 flex gap-4">
        <Link href="/chat">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
            Start Chatting
          </button>
        </Link>
      </div>
    </div>
  );
}