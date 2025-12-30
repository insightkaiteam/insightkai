"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Send, ArrowLeft, Loader2, MapPin } from "lucide-react";
import Link from "next/link";

// PDF VIEWER IMPORTS
import { Worker, Viewer, DocumentLoadEvent } from "@react-pdf-viewer/core";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import { searchPlugin } from "@react-pdf-viewer/search";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";

// ⚠️ REPLACE WITH YOUR RENDER URL
const BACKEND_URL = "https://insightkai.onrender.com";

type ChatMessage = {
    role: "user" | "ai";
    content: string;
    citations?: any[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Builds a tolerant regex that matches across PDF line breaks/hyphenation/odd whitespace.
// This is intentionally permissive because PDF text layers often insert breaks.
function buildFlexibleRegexFromText(raw: string) {
    const cleaned = (raw ?? "")
        .replace(/[“”"]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) return null;

    const pattern = cleaned
        .split("")
        .map((ch) => {
            if (/\s/.test(ch)) {
                return "[\\s\\n\\r\\u00AD\\u200B\\-]*";
            }
            return escapeRegExp(ch);
        })
        .join("");

    return new RegExp(pattern, "gi");
}

// Shingles: pick a few word windows so partial matches still highlight.
// This avoids needing pdfjs page text extraction and works with the viewer’s text layer.
function makeShingles(raw: string, wordsPerShingle = 12) {
    const cleaned = (raw ?? "")
        .replace(/[“”"]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const words = cleaned.split(" ").filter(Boolean);
    if (words.length === 0) return [];

    // If short, just return the whole thing
    if (words.length <= wordsPerShingle) return [cleaned];

    const windows: string[] = [];
    const start = 0;
    const mid = Math.max(0, Math.floor(words.length / 2) - Math.floor(wordsPerShingle / 2));
    const end = Math.max(0, words.length - wordsPerShingle);

    const pushWindow = (idx: number) => {
        const w = words.slice(idx, idx + wordsPerShingle).join(" ").trim();
        if (w) windows.push(w);
    };

    pushWindow(start);
    pushWindow(mid);
    pushWindow(end);

    // De-dup
    return Array.from(new Set(windows));
}

const MarkdownBlock = ({ content }: { content: string }) => {
    return (
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {content}
        </ReactMarkdown>
    );
};

const TypewriterMarkdown = ({ content, animate = false }: { content: string; animate?: boolean }) => {
    const [displayedContent, setDisplayedContent] = useState(animate ? "" : content);
    const hasAnimated = useRef(!animate);

    useEffect(() => {
        if (!animate) {
            setDisplayedContent(content);
            return;
        }

        if (hasAnimated.current) {
            setDisplayedContent(content);
            return;
        }

        let i = -1;
        const speed = 5;

        const timer = setInterval(() => {
            i++;
            if (i <= content.length) setDisplayedContent(content.slice(0, i));
            else {
                clearInterval(timer);
                hasAnimated.current = true;
            }
        }, speed);

        return () => clearInterval(timer);
    }, [content, animate]);

    return <MarkdownBlock content={displayedContent} />;
};

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
    const { docId } = use(params);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Keep doc reference if you later want bbox/highlight-plugin style highlighting
    const [pdfDocument, setPdfDocument] = useState<any>(null);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 1) Initialize plugins ONCE (important: avoid recreating stores on rerender)
    const pageNavigationPluginInstance = useMemo(() => pageNavigationPlugin(), []);
    const searchPluginInstance = useMemo(() => searchPlugin(), []);

    const { jumpToPage } = pageNavigationPluginInstance;
    const { highlight, clearHighlights } = searchPluginInstance;

    // 2) Capture PDF document on load
    const handleDocumentLoad = (e: DocumentLoadEvent) => {
        setPdfDocument(e.doc);
    };

    // 3) Citation click -> jump + highlight
    const handleCitationClick = async (clickedCit: any) => {
        if (!clickedCit?.page) return;

        // Clear existing highlights first so repeats feel deterministic
        clearHighlights();

        // Jump to the page (react-pdf-viewer uses 0-based page index for navigation plugin)
        jumpToPage(Math.max(0, Number(clickedCit.page) - 1));

        // Give the viewer a moment to render the page + text layer
        await sleep(250);

        const lastAiMsg = [...messages].reverse().find((m) => m.role === "ai");
        const citationsOnPage =
            lastAiMsg?.citations?.filter((c: any) => c.page === clickedCit.page) ?? [clickedCit];

        // Build a robust set of regexes:
        // - Try the full citation text
        // - Also try a few shingles (start/mid/end) for partial matching
        const regexes: RegExp[] = [];

        for (const cit of citationsOnPage) {
            const full = buildFlexibleRegexFromText(cit?.content ?? "");
            if (full) regexes.push(full);

            for (const shingle of makeShingles(cit?.content ?? "", 12)) {
                const r = buildFlexibleRegexFromText(shingle);
                if (r) regexes.push(r);
            }
        }

        // De-dup regexes by their source pattern
        const uniqueRegexes = Array.from(new Map(regexes.map((r) => [r.source, r])).values());

        // IMPORTANT: pass RegExp directly (not `{ keyword: /.../ }`)
        if (uniqueRegexes.length > 0) {
            highlight(uniqueRegexes);
        } else if (citationsOnPage.length > 0) {
            // Last resort: try literal strings (less robust but better than nothing)
            highlight(
                citationsOnPage
                    .map((c: any) => (typeof c?.content === "string" ? c.content.trim() : ""))
                    .filter(Boolean)
            );
        }
    };

    const sendMessage = async (textOverride?: string) => {
        const messageToSend = typeof textOverride === "string" ? textOverride : input;
        if (!messageToSend.trim()) return;

        const userMsg: ChatMessage = { role: "user", content: messageToSend };
        setMessages((prev) => [...prev, userMsg]);

        setInput("");
        setIsLoading(true);

        try {
            const historyPayload = messages.map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
            }));

            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: messageToSend,
                    document_id: docId,
                    history: historyPayload,
                }),
            });

            const data = await response.json();
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: data.answer, citations: data.citations },
            ]);
        } catch (error) {
            setMessages((prev) => [...prev, { role: "ai", content: "Sorry, something went wrong." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            {/* LEFT: PDF VIEWER */}
            <div className="w-1/2 h-full border-r border-gray-200 bg-white relative">
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                    <Viewer
                        fileUrl={`${BACKEND_URL}/documents/${docId}/download`}
                        plugins={[pageNavigationPluginInstance, searchPluginInstance]}
                        onDocumentLoad={handleDocumentLoad}
                    />
                </Worker>

                <div className="absolute top-4 left-4 z-20">
                    <Link
                        href="/dashboard"
                        className="p-2 bg-white/90 backdrop-blur border border-gray-200 rounded-xl hover:bg-black hover:text-white transition shadow-sm flex items-center justify-center"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                </div>
            </div>

            {/* RIGHT: CHAT */}
            <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
                <div className="p-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <h1 className="font-bold text-xl tracking-tight text-gray-900">Document Chat</h1>
                    <p className="text-xs text-gray-400 font-medium mt-1">SOTA Analyst Mode</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[#fafafa]">
                    {messages.map((m, i) => {
                        const isLast = i === messages.length - 1;

                        return (
                            <div
                                key={i}
                                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                            >
                                <div
                                    className={`p-4 max-w-[85%] rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        m.role === "user"
                                            ? "bg-black text-white rounded-br-none"
                                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                                    }`}
                                >
                                    {m.role === "ai" ? (
                                        <div className="prose prose-sm max-w-none">
                                            <TypewriterMarkdown content={m.content} animate={isLast} />
                                        </div>
                                    ) : (
                                        <div className="prose prose-sm prose-invert max-w-none">
                                            <MarkdownBlock content={m.content} />
                                        </div>
                                    )}
                                </div>

                                {m.role === "ai" && m.citations && m.citations.length > 0 && (
                                    <div className="mt-3 space-y-2 w-[85%]">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                            <MapPin size={10} /> Source Highlights
                                        </p>

                                        {m.citations.slice(0, 12).map((cit: any, idx: number) => (
                                            <div
                                                key={idx}
                                                onClick={() => handleCitationClick(cit)}
                                                className="bg-white border border-gray-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        Page {cit.page}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 italic line-clamp-2 group-hover:text-gray-900 transition-colors">
                                                    {cit.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div ref={messagesEndRef} />

                    {isLoading && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 px-4 animate-pulse">
                            <Loader2 size={12} className="animate-spin" />
                            Analyzing document...
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-white">
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:ring-4 focus-within:ring-blue-50">
                        <textarea
                            className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm resize-none max-h-32 placeholder:text-gray-400 focus:outline-none"
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="Ask a question..."
                        />

                        <button
                            onClick={() => sendMessage()}
                            className="w-12 h-12 bg-black text-white rounded-xl hover:scale-105 active:scale-95 transition shadow-lg flex items-center justify-center"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
