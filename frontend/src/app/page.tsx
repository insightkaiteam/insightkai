"use client";
import Link from 'next/link';
import { 
  ArrowRight, Mic, Search, Share2, ShieldCheck, BrainCircuit, 
  FileText, CheckCircle2, Layers, Sparkles, Files, ScanSearch, 
  GitMerge, MoveRight, Coins, Users, Database, BookOpen, UserCheck 
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-black selection:text-white overflow-x-hidden">
      
      {/* 1. NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-0 group cursor-pointer">
            <span className="text-xl font-medium tracking-tight">insight</span>
            <span className="w-5 h-5 bg-black rounded flex items-center justify-center text-white font-serif italic font-bold text-xs mx-0.5 group-hover:rotate-12 transition-transform">κ</span>
            <span className="text-xl font-mono font-bold tracking-tighter">AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold">
            <Link href="#" className="text-gray-500 hover:text-black transition">Enterprise</Link>
            <Link href="/dashboard" className="bg-black text-white px-5 py-2 rounded-full hover:scale-105 transition">Launch Console</Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <Sparkles size={12} /> New: Mistral OCR Integration
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
                The Operating System for <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-black">Institutional Knowledge</span>
            </h1>
            
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-100">
                Turn your static PDF archives into a live, queryable intelligence network. 
                Perform deep research, extract financial data, and audit documents in milliseconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                <Link href="/dashboard" className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition shadow-xl shadow-black/10 flex items-center gap-2">
                    <BrainCircuit size={20} /> Start Researching
                </Link>
                {/* NEW: HIRING KAI ENTRY POINT */}
                <Link href="/dashboard?folder=Hiring%20Kai" className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-2 group">
                    <UserCheck size={20} className="text-blue-600 group-hover:scale-110 transition"/> Hiring Kai
                </Link>
            </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-1 opacity-50">
                <span className="font-medium tracking-tight text-sm">insight</span>
                <span className="w-4 h-4 bg-black rounded flex items-center justify-center text-white font-serif italic font-bold text-[10px]">κ</span>
                <span className="font-mono font-bold tracking-tighter text-sm">AI</span>
            </div>
            <p className="text-gray-400 text-sm">© 2025 InsightKai Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}