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
            <Link href="/dashboard">
              <button className="bg-black text-white px-5 py-2 rounded-full hover:bg-gray-800 transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform duration-200">
                Launch Console
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* LEFT: STRATEGIC MESSAGING */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              SOTA Intelligence Engine v2.0
            </div>
            
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-[1.1] mb-6 text-gray-900">
              Advanced Document <br/>
              Intelligence.
            </h1>
            
            <p className="text-xl text-gray-500 mb-8 max-w-lg leading-relaxed font-medium">
              Manual PDF research drains productivity. Get evidence-backed insights, organize/search your document library, and reclaim thousands of hours.
            </p>

            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl w-fit mb-10 text-gray-700 text-sm font-bold">
                <ShieldCheck size={18} className="text-gray-900" />
                <span>100% Verifiable Citations across your PDF library.</span>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* PRIMARY ACTION */}
              <Link href="/dashboard">
                <button className="px-10 py-5 bg-black text-white rounded-[1.5rem] font-bold text-lg hover:bg-gray-900 transition flex items-center gap-2 shadow-2xl shadow-gray-300 transform hover:-translate-y-1">
                  Start Researching <ArrowRight size={20}/>
                </button>
              </Link>

              {/* NEW: HIRING KAI ACTION */}
              <Link href="/dashboard?folder=Hiring%20Kai">
                <button className="px-10 py-5 bg-white text-gray-900 border-2 border-gray-200 rounded-[1.5rem] font-bold text-lg hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-2 shadow-xl shadow-gray-100 transform hover:-translate-y-1 group">
                  <UserCheck size={20} className="text-gray-500 group-hover:text-black transition"/> Hiring Kai
                </button>
              </Link>
            </div>
          </div>

          {/* RIGHT: DYNAMIC FEATURE QUADRANT */}
          <div className="relative grid grid-cols-2 gap-4">
                {/* Q1: VERIFIABLE DIALOGUE */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col justify-between h-64 hover:shadow-2xl transition duration-500 group">
                    <div>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><ScanSearch size={20}/></div>
                        <h3 className="font-bold text-gray-900 text-lg">Verifiable Dialogue</h3>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Evidence Over Hallucination</p>
                    </div>
                    <div className="relative h-12 bg-gray-50 rounded-lg border border-gray-100 p-2 overflow-hidden">
                        <div className="w-full h-1.5 bg-gray-200 rounded opacity-20 mb-1"></div>
                        <div className="w-3/4 h-1.5 bg-emerald-200 rounded animate-highlight"></div>
                        <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[7px] px-1.5 py-0.5 rounded-full animate-proof-snap shadow-md font-bold">PROOF: p.14</div>
                    </div>
                </div>

                {/* Q2: SELF-SORTING HUB */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col justify-between h-64 hover:shadow-2xl transition duration-500 group">
                    <div>
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4"><Database size={20}/></div>
                        <h3 className="font-bold text-gray-900 text-lg">Self-Sorting Library</h3>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Tagged, Sorted, Searchable</p>
                    </div>
                    <div className="flex justify-center gap-1">
                        <div className="w-4 h-6 bg-blue-100 rounded animate-magnet"></div>
                        <div className="w-4 h-6 bg-blue-50 rounded animate-magnet" style={{animationDelay:'0.5s'}}></div>
                        <div className="w-4 h-6 bg-blue-100 rounded animate-magnet" style={{animationDelay:'1s'}}></div>
                    </div>
                </div>

                {/* Q3: INSTITUTIONAL INTELLIGENCE */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col justify-between h-64 hover:shadow-2xl transition duration-500 group">
                    <div>
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4"><BrainCircuit size={20}/></div>
                        <h3 className="font-bold text-gray-900 text-lg">Institutional Intelligence</h3>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1">Enterprise Document Brain</p>
                    </div>
                    <div className="flex justify-center items-center gap-2">
                        <BookOpen size={16} className="text-amber-500 animate-pulse"/>
                        <MoveRight size={12} className="text-gray-300"/>
                        <div className="flex gap-0.5">
                            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                        </div>
                    </div>
                </div>

                {/* Q4: HUMAN VOICE DIALOGUE */}
                <div className="bg-gray-900 p-6 rounded-[2.5rem] shadow-xl border border-gray-800 flex flex-col justify-between h-64 hover:shadow-2xl transition duration-500 group">
                    <div>
                        {/* Changed indigo to slate/white for monochrome look */}
                        <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center mb-4"><Mic size={20}/></div>
                        <h3 className="font-bold text-white text-lg leading-tight">Human-Level Voice</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Talk To Your Documents</p>
                    </div>
                    <div className="flex gap-1 items-center justify-center h-8">
                        {[...Array(6)].map((_,i) => (
                            <div key={i} className="w-1 bg-white rounded-full animate-wave-liquid" style={{animationDelay: `${i*0.15}s`}}></div>
                        ))}
                    </div>
                </div>
          </div>
        </div>
        
        {/* Individuals Anchor */}
        <div className="max-w-7xl mx-auto px-6 mt-12 flex justify-center md:justify-start">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm text-sm font-bold text-gray-600">
                <Coins size={14} className="text-amber-500"/> Individuals: Starts at <strong>$3.99/mo</strong>
            </div>
        </div>
      </section>

      {/* 3. WORKFLOW GALLERY (REFINED CARDS) */}
      <section className="py-24 px-6 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 max-w-2xl mx-auto">
                <h2 className="text-4xl font-bold mb-4 tracking-tight">No one understands documents like us.</h2>
                <p className="text-gray-500 font-bold text-lg">Built and loved by researchers, financial analysts, and startups.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                
                {/* CARD 1 */}
                <div className="bg-gray-50 rounded-[2.5rem] p-10 hover:bg-emerald-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition duration-300 text-emerald-600"><ScanSearch size={32}/></div>
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Verification</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">PDF Chat with Verified Evidence</h3>
                    <p className="text-gray-600 text-sm font-medium mb-6 leading-relaxed">
                        Trust every answer. Skip the guesswork with responses that link directly to the exact page and paragraph in your PDF for total proof.
                    </p>
                </div>

                {/* CARD 2 */}
                <div className="bg-gray-50 rounded-[2.5rem] p-10 hover:bg-blue-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition duration-300 text-blue-600"><Database size={32}/></div>
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Retrieval</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">Organized and Searchable Document Library</h3>
                    <p className="text-gray-600 text-sm font-medium mb-6 leading-relaxed">
                        Stop drowning in PDFs. We automatically sort, tag, and organize your files so you can search across your entire library to find exactly what you need in seconds.
                    </p>
                </div>

                {/* CARD 3 */}
                <div className="bg-gray-50 rounded-[2.5rem] p-10 hover:bg-amber-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition duration-300 text-amber-600"><BrainCircuit size={32}/></div>
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Enterprise</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">Enterprise Knowledge Engine</h3>
                    <p className="text-gray-600 text-sm font-medium mb-6 leading-relaxed">
                        Build a shared brain for your team. Upload your manuals and policies once to give your entire company a single, reliable source of truth.
                    </p>
                </div>

                {/* CARD 4: HUMAN-LEVEL VOICE (Monochrome) */}
                <div className="bg-gray-50 rounded-[2.5rem] p-10 hover:bg-gray-100 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        {/* Changed text-indigo-600 to text-slate-600 */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition duration-300 text-slate-600"><Mic size={32}/></div>
                        <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Mobility</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-4 tracking-tight text-gray-900">Human-Level Voice Input</h3>
                    <p className="text-gray-600 text-sm font-medium mb-6 leading-relaxed">
                        Talk to your documents. Use state-of-the-art audio input to naturally query your library and get deep research results entirely hands-free.
                    </p>
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