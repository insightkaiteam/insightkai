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
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <Sparkles size={12} /> New: Mistral OCR Integration
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000">
                The Operating System for <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-600 to-black">Institutional Knowledge</span>
            </h1>
            
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-100">
                Turn your static PDF archives into a live, queryable intelligence network. 
                Perform deep research, extract financial data, and audit documents in milliseconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                <Link href="/dashboard" className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition shadow-xl shadow-black/10 flex items-center gap-2">
                    <BrainCircuit size={20} /> Start Researching
                </Link>
                
                {/* --- NEW HIRING KAI BUTTON --- */}
                <Link href="/dashboard?folder=Hiring%20Kai" className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-2 group shadow-sm">
                    <UserCheck size={20} className="text-gray-600 group-hover:scale-110 transition"/> Hiring Kai
                </Link>
            </div>
        </div>
      </section>

      {/* 3. FEATURE BENTO GRID */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-gray-50 rounded-[2.5rem] p-10 border border-gray-200 relative overflow-hidden group hover:shadow-lg transition duration-500">
                <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110 duration-700">
                    <Files size={200} />
                </div>
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm"><Layers size={24}/></div>
                    <h3 className="text-2xl font-bold mb-3">Multi-Modal Ingestion</h3>
                    <p className="text-gray-500 max-w-md">Drag & drop PDFs, Scan Images, or Excel sheets. Our pipeline auto-classifies, OCRs, and indexes content into a semantic knowledge graph.</p>
                </div>
                <div className="mt-10 flex gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 animate-stack-1">
                        <div className="bg-red-100 p-2 rounded-lg text-red-600"><FileText size={16}/></div>
                        <div className="h-2 w-20 bg-gray-100 rounded-full"></div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 animate-stack-2">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><ScanSearch size={16}/></div>
                        <div className="h-2 w-20 bg-gray-100 rounded-full"></div>
                    </div>
                </div>
            </div>

            <div className="bg-black text-white rounded-[2.5rem] p-10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-50"></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm"><Search size={24}/></div>
                        <h3 className="text-2xl font-bold mb-3">Neural Retrieval</h3>
                        <p className="text-gray-400">Not just keywords. Ask complex questions like "Compare the risk factors between Q1 and Q4".</p>
                    </div>
                    <div className="mt-8 bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10">
                        <div className="flex gap-3 items-center">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-mono text-gray-300">Processing Query...</span>
                        </div>
                    </div>
                </div>
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