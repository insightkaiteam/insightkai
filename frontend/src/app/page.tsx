"use client";
import Link from 'next/link';
import { 
  ArrowRight, Mic, Search, Share2, ShieldCheck, BrainCircuit, 
  FileText, CheckCircle2, Layers, Sparkles, Files, ScanSearch, 
  GitMerge, MoveRight, Coins, Users, Database, BookOpen 
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

      {/* 2. HERO SECTION (PROFESSIONAL QUADRANT) */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* LEFT: STRATEGIC MESSAGING */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Intelligence Engine v2.0
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-[1.1] mb-6 text-gray-900">
              Advanced Document <br/>
              Intelligence.
            </h1>
            
            <p className="text-xl text-gray-500 mb-8 max-w-lg leading-relaxed">
              Manual perusal is a liability. Leverage state-of-the-art vision and reasoning to extract facts, manage libraries, and share intelligence with human-level accuracy.
            </p>

            {/* Proof Banner */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl w-fit mb-10 text-emerald-900 text-sm font-medium">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>100% Verifiable Citations across your PDF library.</span>
            </div>

            <div className="flex gap-4">
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-gray-900 transition flex items-center gap-2 shadow-xl shadow-gray-200 transform hover:-translate-y-1">
                  Start Researching <ArrowRight size={18}/>
                </button>
              </Link>
            </div>
          </div>

          {/* RIGHT: DYNAMIC FEATURE QUADRANT */}
          <div className="relative">
            {/* Dark Backdrop for Contrast */}
            <div className="absolute inset-0 bg-gray-900 rounded-[2.5rem] rotate-1 opacity-5"></div>
            
            <div className="relative grid grid-cols-2 gap-3 p-3 bg-white/50 backdrop-blur-sm rounded-[2.5rem] border border-white/20 shadow-2xl">
                
                {/* Q1: EVIDENCE-BASED Q&A */}
                <div className="group bg-white p-6 rounded-[2rem] border border-gray-100 hover:border-emerald-200 hover:shadow-lg transition-all duration-300 relative overflow-hidden h-64 flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><ScanSearch size={20}/></div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">Evidence-Based Q&A</h3>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">Deep answers with deep-link citations. No hallucinations, only proof.</p>
                        {/* Animation */}
                        <div className="bg-gray-50 p-2 rounded border border-gray-100 text-[10px] text-gray-400 relative font-mono">
                            <span className="relative z-10 text-gray-800 animate-highlight">Net Income: $4.2M</span>
                            <div className="absolute -top-3 right-0 bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 rounded animate-badge">REF: p.14</div>
                        </div>
                    </div>
                </div>

                {/* Q2: SEMANTIC VAULT */}
                <div className="group bg-white p-6 rounded-[2rem] border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 relative overflow-hidden h-64 flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><Database size={20}/></div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">Semantic Vault</h3>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">Organize 1,000+ PDFs instantly. Auto-tagging and clustering at scale.</p>
                        {/* Animation */}
                        <div className="flex justify-center items-end h-8 gap-1">
                            <div className="w-6 h-8 bg-blue-100 border border-blue-200 rounded animate-stack-1"></div>
                            <div className="w-6 h-8 bg-blue-50 border border-blue-100 rounded -ml-4 mb-1 animate-stack-2"></div>
                            <span className="text-[9px] bg-gray-900 text-white px-1.5 rounded self-center ml-2">Sorted</span>
                        </div>
                    </div>
                </div>

                {/* Q3: SHARED INTELLIGENCE */}
                <div className="group bg-white p-6 rounded-[2rem] border border-gray-100 hover:border-amber-200 hover:shadow-lg transition-all duration-300 relative overflow-hidden h-64 flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><BrainCircuit size={20}/></div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">Shared Intelligence</h3>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">Process once, deploy everywhere. Centralize manuals and policy.</p>
                        {/* Animation */}
                        <div className="flex justify-center items-center gap-3 mt-1">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-400 rounded-full animate-network"></div>
                                <BookOpen size={16} className="text-amber-600 relative z-10"/>
                            </div>
                            <div className="h-px w-8 bg-amber-200"></div>
                            <div className="flex gap-1">
                                <Users size={12} className="text-gray-400"/>
                                <Users size={12} className="text-gray-400"/>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Q4: AMBIENT INTERACTION */}
                <div className="group bg-gray-900 p-6 rounded-[2rem] border border-gray-800 hover:shadow-xl transition-all duration-300 relative overflow-hidden h-64 flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 bg-gray-800 text-white rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition"><Mic size={20}/></div>
                        <h3 className="font-bold text-white text-lg leading-tight">Ambient Interaction</h3>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 leading-relaxed mb-3">Research hands-free. State-of-the-art audio for the morning walk.</p>
                        {/* Animation */}
                        <div className="flex gap-1 items-center h-6 opacity-80">
                            {[...Array(8)].map((_,i) => (
                                <div key={i} className="w-1 bg-white rounded-full animate-wave" style={{animationDelay: `${i*0.1}s`}}></div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* Pricing Anchor */}
            <div className="mt-6 text-center">
                <span className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm text-sm font-medium text-gray-600 hover:text-black hover:border-gray-300 transition cursor-pointer">
                    <Coins size={14} /> Individuals: Starts at <strong>$3.99/mo</strong>
                </span>
            </div>
          </div>

        </div>
      </section>

      {/* 3. WORKFLOW GALLERY (EXISTING) */}
      <section className="py-24 px-6 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold mb-4">Built for High-Stakes Workflows.</h2>
                <p className="text-gray-500">Don't just store PDFs. Transform them into a competitive advantage.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                
                {/* WORKFLOW 1: Morning Walk */}
                <div className="bg-gray-50 rounded-[2.5rem] p-8 md:p-12 hover:bg-indigo-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm"><Mic size={32} className="text-indigo-600"/></div>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Multimodal</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">The "Morning Walk" Researcher</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Upload 10 complex reports. During your commute, ask: <em>"What are the core contradictions in the methodology?"</em> insightκAI reads back a cited summary, saving you 2 hours of desk time.
                    </p>
                    <div className="h-16 bg-white rounded-xl border border-gray-200 flex items-center px-4 gap-2 opacity-80 group-hover:opacity-100 transition">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 w-2/3"></div>
                        </div>
                        <span className="text-xs font-mono text-gray-500">04:12</span>
                    </div>
                </div>

                {/* WORKFLOW 2: Resume Matchmaker */}
                <div className="bg-gray-50 rounded-[2.5rem] p-8 md:p-12 hover:bg-amber-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm"><GitMerge size={32} className="text-amber-600"/></div>
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Enterprise</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">The Resume Matchmaker</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Instantly rank 150 resumes against a Job Description. Ask: <em>"Find the top 5 candidates with Rust experience."</em> We cite the exact projects in their PDFs. No manual screening.
                    </p>
                    <div className="space-y-2">
                         <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                            <div className="flex-1 text-sm font-bold text-gray-800">Jane Doe - Senior Rust Eng</div>
                            <CheckCircle2 size={16} className="text-green-500"/>
                         </div>
                         <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-gray-200 border-dashed">
                            <div className="w-6 h-6 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                            <div className="flex-1 text-sm text-gray-500">John Smith - Backend Dev</div>
                            <span className="text-xs text-gray-400">92% Match</span>
                         </div>
                    </div>
                </div>

                {/* WORKFLOW 3: Analyst's Vault */}
                <div className="bg-gray-50 rounded-[2.5rem] p-8 md:p-12 hover:bg-emerald-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm"><ScanSearch size={32} className="text-emerald-600"/></div>
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Finance / Legal</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">The Analyst's Vault</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Stop guessing. Ask: <em>"Calculate total EBITDA across these 12 quarterly PDF statements."</em> Get a calculated answer where every figure is a clickable link to the source page.
                    </p>
                    <div className="p-4 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 shadow-sm">
                        Total EBITDA: <span className="font-bold">$4.2M</span> <span className="text-emerald-600 font-bold cursor-pointer hover:underline">[ref: Q3_Report.pdf, p.14]</span>
                    </div>
                </div>

                {/* WORKFLOW 4: Zero Clutter */}
                <div className="bg-gray-50 rounded-[2.5rem] p-8 md:p-12 hover:bg-rose-50/50 transition duration-500 border border-gray-100 group">
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm"><Layers size={32} className="text-rose-600"/></div>
                        <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Operations</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">Zero-Clutter Library</h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Upload 100+ random files (invoices, contracts, receipts). Our engine reads, identifies, and auto-tags them: <span className="font-mono text-xs bg-gray-200 px-1 rounded">@INVOICE</span>, <span className="font-mono text-xs bg-gray-200 px-1 rounded">@LEGAL</span>. A structured intelligence hub, instantly.
                    </p>
                    <div className="flex gap-2">
                        <span className="bg-white border border-rose-200 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">tax_2023.pdf</span>
                        <span className="bg-white border border-blue-200 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">contract_v2.pdf</span>
                        <span className="bg-white border border-green-200 text-green-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">receipt.pdf</span>
                    </div>
                </div>

            </div>
        </div>
      </section>

      {/* 4. PRICING ANCHOR */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <h2 className="text-xs font-bold text-center uppercase tracking-widest text-gray-400 mb-12">Flexible Pricing</h2>
        
        <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* INDIVIDUALS */}
            <Link href="/dashboard" className="group h-full">
                <div className="h-full p-10 rounded-[2.5rem] border-2 border-gray-100 hover:border-black hover:shadow-2xl transition duration-300 bg-white relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 bg-gray-900 text-white px-4 py-2 rounded-bl-2xl text-xs font-bold">MOST POPULAR</div>
                    
                    <div className="mb-6 bg-gray-50 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:bg-black group-hover:text-white transition duration-300">
                        <FileText size={32} />
                    </div>
                    
                    <h3 className="text-3xl font-bold mb-2">Individuals</h3>
                    <p className="text-gray-500 mb-6 text-sm">The cost of a coffee to reclaim 20+ hours a week.</p>
                    
                    <div className="text-5xl font-bold mb-8 tracking-tight">$3.99<span className="text-lg text-gray-400 font-medium tracking-normal">/mo</span></div>

                    <ul className="space-y-4 text-gray-600 mb-8 text-sm font-medium flex-1">
                        <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-black"/> <strong>1,000 pages</strong> / month</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-black"/> Deep Research & Citations</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-black"/> Audio Input</li>
                    </ul>
                    <span className="inline-block w-full text-center bg-gray-50 border border-gray-200 py-4 rounded-xl font-bold text-gray-900 group-hover:bg-black group-hover:text-white transition">Get Started &rarr;</span>
                </div>
            </Link>

            {/* ENTERPRISE */}
            <Link href="/dashboard" className="group h-full">
                <div className="h-full p-10 rounded-[2.5rem] bg-black text-white hover:scale-[1.02] transition duration-300 shadow-2xl relative flex flex-col">
                    
                    <div className="mb-6 bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <BrainCircuit size={32} className="text-white"/>
                    </div>

                    <h3 className="text-3xl font-bold mb-2">Enterprise</h3>
                    <p className="text-gray-400 mb-6 text-sm">Shared intelligence for high-performance teams.</p>
                    
                    <div className="text-5xl font-bold mb-8 tracking-tight">Custom</div>

                    <ul className="space-y-4 text-gray-300 mb-8 text-sm font-medium flex-1">
                        <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-white"/> Unlimited Resume & JD Matching</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-white"/> Bulk Invoice Processing (10k+)</li>
                        <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-white"/> API Access & SSO</li>
                    </ul>
                    <span className="inline-block w-full text-center bg-white/10 border border-white/20 py-4 rounded-xl font-bold text-white group-hover:bg-white group-hover:text-black transition">Launch Console &rarr;</span>
                </div>
            </Link>
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