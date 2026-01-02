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
            <Link href="/dashboard" className="bg-black text-white px-5 py-2 rounded-full hover:scale-105 transition">Launch Console</Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-gray-200">
                <Sparkles size={12} /> New: Mistral OCR Integration
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
                The Operating System for <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-600 to-black">Institutional Knowledge</span>
            </h1>
            
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Turn your static PDF archives into a live, queryable intelligence network. 
                Perform deep research, extract financial data, and audit documents in milliseconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/dashboard" className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:scale-105 transition shadow-xl flex items-center gap-2">
                    <BrainCircuit size={20} /> Start Researching
                </Link>
                
                {/* --- HIRING KAI BUTTON --- */}
                <Link href="/dashboard?folder=Hiring%20Kai" className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:bg-gray-50 transition flex items-center gap-2">
                    <UserCheck size={20} className="text-gray-600"/> Hiring Kai
                </Link>
            </div>
        </div>
      </section>

      {/* 3. FEATURE BENTO GRID */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-gray-50 rounded-[2.5rem] p-10 border border-gray-200 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm"><Layers size={24}/></div>
                    <h3 className="text-2xl font-bold mb-3">Multi-Modal Ingestion</h3>
                    <p className="text-gray-500 max-w-md">Drag & drop PDFs, Scan Images, or Excel sheets. Our pipeline auto-classifies, OCRs, and indexes content.</p>
                </div>
            </div>

            <div className="bg-black text-white rounded-[2.5rem] p-10 relative overflow-hidden">
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm"><Search size={24}/></div>
                        <h3 className="text-2xl font-bold mb-3">Neural Retrieval</h3>
                        <p className="text-gray-400">Not just keywords. Ask complex questions like "Compare the risk factors between Q1 and Q4".</p>
                    </div>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}