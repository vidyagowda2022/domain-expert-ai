/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Scale, 
  TrendingUp, 
  Stethoscope, 
  Send, 
  Plus, 
  History, 
  Settings, 
  ChevronRight,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Info,
  Menu,
  X,
  Image as ImageIcon,
  ExternalLink,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Domain, Message, DomainConfig } from './types';
import { DOMAIN_CONFIGS } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Extend Window interface for AI Studio API Key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [activeDomain, setActiveDomain] = useState<Domain>('legal');
  const [histories, setHistories] = useState<Record<Domain, Message[]>>({
    legal: [],
    finance: [],
    medical: []
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const config = DOMAIN_CONFIGS[activeDomain];
  const currentMessages = histories[activeDomain];

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [histories, activeDomain]);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setHistories(prev => ({
      ...prev,
      [activeDomain]: [...prev[activeDomain], userMessage]
    }));
    
    setInput('');
    setIsLoading(true);

    try {
      // Determine model and tools based on intent
      const isImageRequest = /image|picture|draw|generate|visualize|show me/i.test(text);
      
      // Use gemini-3-pro-image-preview for image + search requests
      // Use gemini-3.1-pro-preview for standard search requests
      const modelName = isImageRequest ? "gemini-3-pro-image-preview" : "gemini-3.1-pro-preview";
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [...currentMessages, userMessage].map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: config.systemInstruction + "\nUse Google Search to provide accurate, up-to-date information and links.",
          tools: [{ googleSearch: {} }],
          imageConfig: isImageRequest ? { aspectRatio: "1:1", imageSize: "1K" } : undefined
        },
      });

      let content = '';
      let imageUrl = undefined;
      let links: { uri: string; title: string }[] = [];

      // Extract parts
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.text) content += part.text;
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      // Extract grounding links
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        links = chunks
          .filter(chunk => chunk.web)
          .map(chunk => ({
            uri: chunk.web!.uri,
            title: chunk.web!.title
          }));
      }

      const modelMessage: Message = {
        role: 'model',
        content: content || (imageUrl ? 'Generated image based on your request:' : 'I processed your request.'),
        timestamp: new Date(),
        imageUrl,
        links: links.length > 0 ? links : undefined
      };

      setHistories(prev => ({
        ...prev,
        [activeDomain]: [...prev[activeDomain], modelMessage]
      }));
    } catch (error) {
      console.error('Gemini Error:', error);
      setHistories(prev => ({
        ...prev,
        [activeDomain]: [...prev[activeDomain], {
          role: 'model',
          content: 'Sorry, I am having trouble connecting to my knowledge base or generating that image right now.',
          timestamp: new Date(),
        }]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setHistories(prev => ({
      ...prev,
      [activeDomain]: []
    }));
  };

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 bg-white border-r border-zinc-200 flex flex-col z-20"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight">ExpertAI</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-zinc-100 rounded-md lg:hidden"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {!hasApiKey && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-[10px] uppercase tracking-wider">
                    <Key className="w-3 h-3" />
                    Action Required
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Connect a paid API key to enable high-quality image generation and real-time search.
                  </p>
                  <button 
                    onClick={handleConnectKey}
                    className="w-full py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
                  >
                    Connect API Key
                  </button>
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-center text-[10px] text-amber-600 hover:underline"
                  >
                    Billing Documentation
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 px-2">
                  Specialized Domains
                </h3>
                <div className="space-y-1">
                  {(Object.values(DOMAIN_CONFIGS) as DomainConfig[]).map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setActiveDomain(d.id);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                        activeDomain === d.id 
                          ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" 
                          : "text-zinc-600 hover:bg-zinc-100"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        activeDomain === d.id ? "bg-white/10" : "bg-zinc-100 group-hover:bg-white"
                      )}>
                        {d.id === 'legal' && <Scale className="w-4 h-4" />}
                        {d.id === 'finance' && <TrendingUp className="w-4 h-4" />}
                        {d.id === 'medical' && <Stethoscope className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-medium">{d.name}</span>
                      {activeDomain === d.id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 px-2">
                  Session Stats
                </h3>
                <div className="space-y-2 px-2">
                  {(Object.values(DOMAIN_CONFIGS) as DomainConfig[]).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
                      <span>{d.name}</span>
                      <span className="bg-zinc-100 px-1.5 py-0.5 rounded-full">{histories[d.id].length} msgs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 space-y-2">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <div className="px-3 py-2 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">
                  JD
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Jane Doe</span>
                  <span className="text-[10px] text-zinc-400">Pro Researcher</span>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5 text-zinc-600" />
              </button>
            )}
            <div className="flex flex-col">
              <h2 className="text-sm font-bold flex items-center gap-2">
                {config.name}
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                  activeDomain === 'legal' && "bg-indigo-100 text-indigo-700",
                  activeDomain === 'finance' && "bg-emerald-100 text-emerald-700",
                  activeDomain === 'medical' && "bg-cyan-100 text-cyan-700",
                )}>
                  Expert
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400 font-medium">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500">
              <ShieldCheck className="w-3 h-3" />
              SECURE SESSION
            </div>
            <button 
              onClick={clearChat}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-500"
              title="Clear Active Domain Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
        >
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8">
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl",
                activeDomain === 'legal' && "bg-indigo-600 shadow-indigo-200",
                activeDomain === 'finance' && "bg-emerald-600 shadow-emerald-200",
                activeDomain === 'medical' && "bg-cyan-600 shadow-cyan-200",
              )}>
                {activeDomain === 'legal' && <Scale className="w-10 h-10 text-white" />}
                {activeDomain === 'finance' && <TrendingUp className="w-10 h-10 text-white" />}
                {activeDomain === 'medical' && <Stethoscope className="w-10 h-10 text-white" />}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                  How can I assist your {activeDomain} research today?
                </h1>
                <p className="text-zinc-500 text-sm max-w-md mx-auto">
                  Ask complex questions, analyze documents, or extract specific insights with domain-specific precision.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {config.suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-left p-4 bg-white border border-zinc-200 rounded-2xl hover:border-zinc-400 hover:shadow-md transition-all group"
                  >
                    <p className="text-xs font-medium text-zinc-900 group-hover:text-zinc-700">
                      {suggestion}
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      Quick Query
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {currentMessages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center",
                    message.role === 'user' 
                      ? "bg-zinc-900" 
                      : cn(
                          activeDomain === 'legal' && "bg-indigo-100 text-indigo-600",
                          activeDomain === 'finance' && "bg-emerald-100 text-emerald-600",
                          activeDomain === 'medical' && "bg-cyan-100 text-cyan-600",
                        )
                  )}>
                    {message.role === 'user' ? (
                      <span className="text-[10px] font-bold text-white">JD</span>
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                  <div className={cn(
                    "flex flex-col max-w-[85%]",
                    message.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm shadow-sm space-y-4",
                      message.role === 'user' 
                        ? "bg-zinc-900 text-white" 
                        : "bg-white border border-zinc-200 text-zinc-800"
                    )}>
                      {message.role === 'model' ? (
                        <>
                          <div className="markdown-body">
                            <Markdown>{message.content}</Markdown>
                          </div>
                          {message.imageUrl && (
                            <div className="mt-4 rounded-xl overflow-hidden border border-zinc-100 shadow-sm">
                              <img 
                                src={message.imageUrl} 
                                alt="Generated visual" 
                                className="w-full h-auto object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          {message.links && message.links.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-100">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                Sources & References
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {message.links.map((link, i) => (
                                  <a
                                    key={i}
                                    href={link.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 bg-zinc-50 border border-zinc-100 rounded-md text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors flex items-center gap-1"
                                  >
                                    {link.title}
                                    <ChevronRight className="w-2 h-2" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1.5 font-medium">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center animate-pulse",
                    activeDomain === 'legal' && "bg-indigo-100",
                    activeDomain === 'finance' && "bg-emerald-100",
                    activeDomain === 'medical' && "bg-cyan-100",
                  )}>
                    <Sparkles className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="bg-white border border-zinc-200 px-4 py-3 rounded-2xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-zinc-200">
          <div className="max-w-4xl mx-auto relative">
            <div className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-zinc-900/5 backdrop-blur-sm border border-zinc-900/10 px-3 py-1 rounded-full flex items-center gap-2 text-[10px] font-bold text-zinc-500 pointer-events-auto">
                <ImageIcon className="w-3 h-3" />
                IMAGE & SEARCH ENABLED
              </div>
            </div>
            
            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Ask a ${activeDomain} question or request an image...`}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all resize-none min-h-[60px] max-h-[200px]"
                rows={1}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "absolute right-2 bottom-2 p-2 rounded-xl transition-all duration-200",
                  input.trim() && !isLoading 
                    ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200 hover:scale-105" 
                    : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] text-zinc-400 font-medium">
              ExpertAI uses Google Search for real-time data. Connect a Pro API key for image generation.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
