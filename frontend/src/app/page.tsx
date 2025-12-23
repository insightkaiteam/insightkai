"use client";
import Link from 'next/link';
import { ArrowRight, Mic, Search, Share2, ShieldCheck, BrainCircuit, FileText, CheckCircle2, Layers, Sparkles, Files, ScanSearch, GitMerge } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-black selection:text-white overflow-x-hidden">
      
      {/* 1. NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-0.5 group cursor-pointer">
            <span className="text-xl font-medium tracking-tight">insight</span>
            <span className="w-6 h-6 bg-black rounded flex items-center justify-center text-white font-serif italic font-bold text-sm group-hover:rotate-12 transition-transform">κ</span>
            <span className="text-xl font-mono font-bold tracking-tighter">AI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm font-medium text-gray-500 hover:text-black transition">Enterprise</Link>
            <Link href="/dashboard">
              <button className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform duration-200">
                Launch Console
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-36 pb-24 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* LEFT: COPY */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              SOTA Intelligence Engine v2.0
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              Advanced Document <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-500 to-gray-900">Intelligence is here.</span>
            </h1>
            
            <p className="text-xl text-gray-500 mb-8 max-w-lg leading-relaxed">
              Leverage state-of-the-art vision and audio-processing to extract precise insights, manage complex <span className="font-semibold text-gray-900">PDF libraries</span>, and reason across hundreds of files with human-level accuracy.
            </p>

            <div className="flex flex-col gap-3 mb-10">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <CheckCircle2 size={18} className="text-black" /> Verifiable citations for every insight
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <CheckCircle2 size={18} className="text-black" /> Multimodal input (Text & Audio)
                </div>
            </div>

            <div className="flex gap-4">
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-gray-900 transition flex items-center gap-2 shadow-xl shadow-gray-300 transform hover:-translate-y-1">
                  Start Researching <ArrowRight size={18}/>
                </button>
              </Link>
              <button className="px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-50 transition">
                View Architecture
              </button>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE CARD STACK ANIMATION */}
          <div className="relative h-[500px] w-full flex items-center justify-center perspective-1000">
            
            {/* CARD 1: Reading Invoice (Bottom -> Top) */}
            <div className="absolute w-[380px] bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 animate-card-1 origin-bottom">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600"><FileText size={20}/></div>
                    <div>
                        <h3 className="font-bold text-gray-900">Processing File...</h3>
                        <p className="text-xs text-gray-400 font-mono">invoice_aug_2025.pdf</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="h-2 bg-gray-100 rounded w-full animate-pulse"></div>
                    <div className="h-2 bg-gray-100 rounded w-5/6 animate-pulse"></div>
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-red-800 font-medium">
                        "Total Amount Due: $4,250.00"
                    </div>
                </div>
            </div>

            {/* CARD 2: Organizing Library */}
            <div className="absolute w-[380px] bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 animate-card-2 origin-bottom">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><Layers size={20}/></div>
                    <div>
                        <h3 className="font-bold text-gray-900">Organizing Library</h3>
                        <p className="text-xs text-gray-400 font-mono">Auto-tagging 142 files...</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2 border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div> <span className="text-xs font-bold text-gray-600">[INVOICE]</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2 border border-gray-100">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div> <span className="text-xs font-bold text-gray-600">[FINANCE]</span>
                    </div>
                </div>
            </div>

            {/* CARD 3: Connecting Dots */}
            <div className="absolute w-[380px] bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 animate-card-3 origin-bottom">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600"><GitMerge size={20}/></div>
                    <div>
                        <h3 className="font-bold text-gray-900">Deep Reasoning</h3>
                        <p className="text-xs text-gray-400 font-mono">Linking Report_A.pdf ↔ Report_B.pdf</p>
                    </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-800">
                    <span className="font-bold">Insight:</span> "Q3 projections contradict the fiscal report on page 12."
                </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. FEATURE QUADRANT (BENTO) */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Scientific Precision. <span className="text-gray-400">Zero Friction.</span></h2>
            <p className="text-gray-500">Four pillars of modern document intelligence.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. Evidence-Based Analysis (Teal) */}
            <div className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100 hover:shadow-xl hover:shadow-emerald-100 transition duration-300 group overflow-hidden">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 mb-6 shadow-sm group-hover:scale-110 transition relative">
                    <ScanSearch size={24} className="relative z-10"/>
                    {/* Scanning Animation Layer */}
                    <div className="absolute top-0 left-0 h-full bg-emerald-200/30 animate-scan-text blur-sm"></div>
                </div>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">Evidence-Based Analysis</h3>
                <p className="text-sm text-emerald-700/80 leading-relaxed">
                    Zero Hallucinations. Every insight we generate is backed by a verifiable citation directly from your PDFs.
                </p>
            </div>

            {/* 2. Cross-Doc Logic (Orange) */}
            <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100 hover:shadow-xl hover:shadow-amber-100 transition duration-300 group">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 mb-6 shadow-sm group-hover:scale-110 transition relative">
                    <GitMerge size={24} className="relative z-10"/>
                    {/* Ping Animation Layer */}
                    <div className="absolute bottom-0 h-0.5 bg-amber-400 animate-ping-line"></div>
                </div>
                <h3 className="text-xl font-bold text-amber-900 mb-2">Cross-Doc Logic</h3>
                <p className="text-sm text-amber-700/80 leading-relaxed">
                    Connect the dots. Synthesize conflicting data points and find trends across hundreds of distinct files.
                </p>
            </div>

            {/* 3. Autonomous Library (Rose) */}
            <div className="bg-rose-50 rounded-[2rem] p-8 border border-rose-100 hover:shadow-xl hover:shadow-rose-100 transition duration-300 group">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-600 mb-6 shadow-sm group-hover:scale-110 transition">
                    <Layers size={24} className="animate-stack origin-bottom" />
                </div>
                <h3 className="text-xl font-bold text-rose-900 mb-2">Autonomous Library</h3>
                <p className="text-sm text-rose-700/80 leading-relaxed">
                    Stop drowning in PDFs. We automatically sort, tag, and organize your entire history into a structured graph.
                </p>
            </div>

            {/* 4. Ambient Intelligence (Blue) */}
            <div className="bg-indigo-50 rounded-[2rem] p-8 border border-indigo-100 hover:shadow-xl hover:shadow-indigo-100 transition duration-300 group">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm group-hover:scale-110 transition relative">
                    <Mic size={24} />
                </div>
                <h3 className="text-xl font-bold text-indigo-900 mb-2">Ambient Intelligence</h3>
                <p className="text-sm text-indigo-700/80 leading-relaxed mb-4">
                    SOTA Audio Input. Don't type—just speak complex research queries while on your morning walk.
                </p>
                {/* Waveform Visual */}
                <div className="flex gap-1 items-end h-6 opacity-60">
                    {[...Array(10)].map((_,i) => <div key={i} className="w-1.5 bg-indigo-400 rounded-full animate-waveform" style={{animationDelay: `${i*0.1}s`}}></div>)}
                </div>
            </div>

        </div>
      </section>

      {/* 4. PRICING / DUAL PATH */}
      <section className="py-24 px-6 max-w-5xl mx-auto border-t border-gray-100">
        <h2 className="text-xs font-bold text-center uppercase tracking-widest text-gray-400 mb-12">Select your tier</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
            {/* INDIVIDUALS (PLG Motion) */}
            <Link href="/dashboard" className="group">
                <div className="h-full p-10 rounded-[2.5rem] border border-gray-200 hover:border-black hover:shadow-2xl transition duration-300 bg-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-gray-100 px-4 py-2 rounded-bl-2xl text-xs font-bold text-gray-600">POPULAR</div>
                    
                    <FileText size={40} className="mb-6 text-gray-400 group-hover:text-black transition" />
                    <h3 className="text-3xl font-bold mb-2">Individuals</h3>
                    <p className="text-gray-500 mb-6 text-sm">For students, researchers, and power users.</p>
                    
                    <div className="text-4xl font-bold mb-8">$3.99<span className="text-lg text-gray-400 font-medium">/mo</span></div>

                    <ul className="space-y-4 text-gray-600 mb-8 text-sm font-medium">
                        <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-black"/> Deep dive into single PDFs</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-black"/> 1,000 pages / month</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-black"/> Verifiable Citations</li>
                    </ul>
                    <span className="inline-block w-full text-center bg-gray-50 border border-gray-200 py-3 rounded-xl font-bold text-gray-900 group-hover:bg-black group-hover:text-white transition">Get Started &rarr;</span>
                </div>
            </Link>

            {/* ENTERPRISE */}
            <Link href="/dashboard" className="group cursor-pointer">
                <div className="h-full p-10 rounded-[2.5rem] bg-black text-white hover:scale-[1.02] transition duration-300 shadow-2xl relative">
                    
                    <BrainCircuit size={40} className="mb-6 text-gray-400 group-hover:text-white transition" />
                    <h3 className="text-3xl font-bold mb-2">Enterprise</h3>
                    <p className="text-gray-400 mb-6 text-sm">For teams requiring shared intelligence.</p>
                    
                    <div className="text-4xl font-bold mb-8">Custom<span className="text-lg text-gray-500 font-medium"></span></div>

                    <ul className="space-y-4 text-gray-300 mb-8 text-sm font-medium">
                        <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-white"/> Unlimited Resume & JD Matching</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-white"/> Bulk Invoice Processing</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-white"/> API Access & SSO</li>
                    </ul>
                    <span className="inline-block w-full text-center bg-white/10 border border-white/20 py-3 rounded-xl font-bold text-white group-hover:bg-white group-hover:text-black transition">Launch Console &rarr;</span>
                </div>
            </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-gray-100">
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