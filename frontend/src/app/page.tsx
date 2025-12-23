"use client";
import Link from 'next/link';
import { ArrowRight, Mic, Search, Share2, ShieldCheck, BrainCircuit, FileText } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-black selection:text-white">
      
      {/* 1. NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-serif italic font-bold text-xl">
              κ
            </div>
            <span className="text-xl font-medium tracking-tight">
              insight<span className="font-serif italic font-bold">κ</span><span className="font-mono text-sm bg-gray-100 px-1 py-0.5 rounded ml-0.5">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm font-medium text-gray-500 hover:text-black transition">Enterprise</Link>
            <Link href="/dashboard">
              <button className="bg-black text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform duration-200">
                Launch Console
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-wider mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              v2.0 Now Live
            </div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
              Don't just read.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Command</span> your data.
            </h1>
            <p className="text-xl text-gray-500 mb-8 max-w-lg leading-relaxed">
              The SOTA research assistant that listens, reads, and reasons across your entire library using Mistral OCR 3.0 and Whisper.
            </p>
            <div className="flex gap-4">
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition flex items-center gap-2 shadow-xl shadow-gray-200">
                  Start Researching <ArrowRight size={18}/>
                </button>
              </Link>
              <button className="px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-50 transition">
                View Demo
              </button>
            </div>
          </div>

          {/* VISUAL: The Scanning Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-purple-100 rounded-[2.5rem] transform rotate-3 scale-95 opacity-50 group-hover:rotate-6 transition duration-500"></div>
            <div className="relative bg-white border border-gray-200 rounded-[2rem] p-8 shadow-2xl h-[500px] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="font-mono text-xs text-gray-400">ANALYSIS_MODE: ACTIVE</div>
                </div>
                
                {/* Document */}
                <div className="flex-1 bg-gray-50 rounded-xl p-6 relative overflow-hidden border border-gray-100">
                    <div className="space-y-4 opacity-30 blur-[1px]">
                        <div className="h-4 bg-black w-3/4 rounded"></div>
                        <div className="h-4 bg-gray-400 w-full rounded"></div>
                        <div className="h-4 bg-gray-400 w-5/6 rounded"></div>
                        <div className="h-32 bg-gray-300 rounded-lg w-full mt-4"></div>
                    </div>
                    
                    {/* The Scanline */}
                    <div className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-scanline z-10"></div>
                    
                    {/* The Extracted Insight */}
                    <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-gray-200 shadow-lg z-20 transform translate-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <BrainCircuit size={16} className="text-purple-600" />
                            <span className="text-xs font-bold text-purple-600 uppercase">Insight Extracted</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">
                            "Revenue grew by 24% YoY based on Figure 3.1, driven primarily by enterprise adoption in the APAC region."
                        </p>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BENTO GRID */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Scientific Precision. <span className="text-gray-400">Zero Friction.</span></h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            
            {/* Box 1: Multimodal (Large) */}
            <div className="md:col-span-2 bg-black rounded-3xl p-8 text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="bg-white/10 w-fit p-3 rounded-2xl backdrop-blur-sm"><Mic className="text-white" size={24} /></div>
                    <div>
                        <h3 className="text-2xl font-bold mb-2">Ambient Intelligence</h3>
                        <p className="text-gray-400 max-w-md">Powered by Whisper. Don't type your queries—speak them. We transcribe, analyze, and execute complex research tasks while you walk.</p>
                    </div>
                    {/* Waveform Visual */}
                    <div className="flex gap-1 items-end h-16 mt-4 opacity-50">
                        {[...Array(20)].map((_,i) => (
                            <div key={i} className="w-2 bg-white rounded-full animate-waveform" style={{animationDelay: `${i * 0.1}s`, height: `${Math.random() * 100}%`}}></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Box 2: Deep Search */}
            <div className="bg-gray-100 rounded-3xl p-8 flex flex-col justify-between hover:bg-white hover:shadow-xl transition duration-300 border border-transparent hover:border-gray-200">
                <div className="bg-white w-fit p-3 rounded-2xl shadow-sm"><Search className="text-black" size={24} /></div>
                <div>
                    <h3 className="text-xl font-bold mb-2">Deep Search</h3>
                    <p className="text-sm text-gray-500">We don't just find keywords. We understand semantic meaning across thousands of pages.</p>
                </div>
            </div>

            {/* Box 3: Cross-Doc */}
            <div className="bg-white border border-gray-200 rounded-3xl p-8 flex flex-col justify-between hover:border-blue-500 transition duration-300 group">
                <div className="bg-blue-50 w-fit p-3 rounded-2xl"><Share2 className="text-blue-600" size={24} /></div>
                <div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition">Cross-Doc Logic</h3>
                    <p className="text-sm text-gray-500">Compare Document A vs Document B. Find contradictions. Synthesize new knowledge.</p>
                </div>
            </div>

            {/* Box 4: Privacy */}
            <div className="md:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 flex flex-col justify-between border border-gray-200">
                <div className="flex justify-between items-start">
                    <div className="bg-white w-fit p-3 rounded-2xl shadow-sm"><ShieldCheck className="text-green-600" size={24} /></div>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Enterprise Grade</span>
                </div>
                <div>
                    <h3 className="text-2xl font-bold mb-2">Your data stays yours.</h3>
                    <p className="text-gray-500 max-w-lg">We use ephemeral processing instances. Once your session ends, the data cache is wiped. Zero training on customer data.</p>
                </div>
            </div>
        </div>
      </section>

      {/* 4. DUAL PATH SELECTOR */}
      <section className="py-20 px-6 max-w-5xl mx-auto border-t border-gray-100">
        <h2 className="text-xs font-bold text-center uppercase tracking-widest text-gray-400 mb-12">Choose your workflow</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
            {/* Researcher */}
            <Link href="/dashboard" className="group">
                <div className="h-full p-10 rounded-[2.5rem] border border-gray-200 hover:border-black hover:shadow-2xl transition duration-300 bg-white">
                    <FileText size={40} className="mb-6 text-gray-400 group-hover:text-black transition" />
                    <h3 className="text-3xl font-bold mb-4">Researchers</h3>
                    <ul className="space-y-3 text-gray-500 mb-8">
                        <li className="flex items-center gap-2">✓ Deep dive into single PDFs</li>
                        <li className="flex items-center gap-2">✓ Extract data from complex tables</li>
                        <li className="flex items-center gap-2">✓ Citation-backed answers</li>
                    </ul>
                    <span className="text-black font-bold underline decoration-2 underline-offset-4 group-hover:text-blue-600 transition">Launch Workspace &rarr;</span>
                </div>
            </Link>

            {/* Enterprise */}
            <div className="group cursor-pointer">
                <div className="h-full p-10 rounded-[2.5rem] bg-black text-white hover:scale-[1.02] transition duration-300 shadow-2xl">
                    <BrainCircuit size={40} className="mb-6 text-gray-400 group-hover:text-white transition" />
                    <h3 className="text-3xl font-bold mb-4">Enterprise</h3>
                    <ul className="space-y-3 text-gray-400 mb-8">
                        <li className="flex items-center gap-2">✓ Resume & JD Matching</li>
                        <li className="flex items-center gap-2">✓ Bulk Invoice Processing</li>
                        <li className="flex items-center gap-2">✓ API Access</li>
                    </ul>
                    <span className="text-white font-bold underline decoration-2 underline-offset-4">Contact Sales &rarr;</span>
                </div>
            </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 text-center text-gray-400 text-sm">
        <p>© 2025 InsightKai Inc. Built with Mistral & Whisper.</p>
      </footer>
    </div>
  );
}