"use client";
import { useState, use, useRef, useEffect } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { highlightPlugin, RenderHighlightsProps } from '@react-pdf-viewer/highlight';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
// ... (imports for other components)

export default function ChatPage({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = use(params);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<any>(null);

  // 1. Initialize Highlighting Plugin
  const highlightPluginInstance = highlightPlugin({
    renderHighlights: (props: RenderHighlightsProps) => (
      <div>
        {activeHighlight && activeHighlight.pageIndex === props.pageIndex && (
          <div
            className="highlight-overlay"
            style={{
              background: 'rgba(255, 255, 0, 0.4)', // Yellow highlight
              position: 'absolute',
              left: `${activeHighlight.left}%`,
              top: `${activeHighlight.top}%`,
              width: `${activeHighlight.width}%`,
              height: `${activeHighlight.height}%`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}
      </div>
    ),
  });

  const { jumpToPage } = highlightPluginInstance;

  // 2. Logic to handle Citation Click
  const handleCitationClick = (citation: any) => {
    if (!citation.page) return;
    
    // Jump to the specific page (0-indexed)
    jumpToPage(citation.page - 1);

    // If backend sent coordinates, activate the overlay
    if (citation.coords && citation.coords.length > 0) {
      // Mistral coords are typically [ymin, xmin, ymax, xmax] in 0-1000 scale
      const [ymin, xmin, ymax, xmax] = citation.coords;
      setActiveHighlight({
        pageIndex: citation.page - 1,
        top: ymin / 10,      // Convert to %
        left: xmin / 10,     // Convert to %
        width: (xmax - xmin) / 10,
        height: (ymax - ymin) / 10,
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* LEFT: SOTA PDF VIEWER */}
      <div className="w-1/2 h-full border-r border-gray-200 bg-white relative">
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
          <Viewer
            fileUrl={`${BACKEND_URL}/documents/${docId}/download`}
            plugins={[highlightPluginInstance]}
          />
        </Worker>
      </div>

      {/* RIGHT: CHAT INTERFACE */}
      <div className="w-full md:w-1/2 flex flex-col h-full bg-white">
        {/* ... Header ... */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i}>
              {/* ... AI Answer text ... */}
              {m.citations?.map((cit: any, idx: number) => (
                <div 
                  key={idx} 
                  onClick={() => handleCitationClick(cit)}
                  className="bg-white border p-3 rounded-xl cursor-pointer hover:border-blue-500 shadow-sm transition-all"
                >
                  <span className="text-xs font-bold text-blue-600">Page {cit.page}</span>
                  <p className="text-sm italic">"{cit.content}"</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}