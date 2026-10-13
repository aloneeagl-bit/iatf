import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, ArrowLeftRight, CheckCircle2, AlertTriangle, Lightbulb, GraduationCap, TrendingUp, Settings, KeyRound, HelpCircle } from 'lucide-react';
import { getGlobalAiModel } from '../lib/aiConfig';
import AiApiKeyGuideModal from './AiApiKeyGuideModal';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface IatfAssistantProps {
  lang: 'fa' | 'en';
  onNavigateToClause?: (clauseId: string) => void;
}

export default function IatfAssistant({ lang, onNavigateToClause }: IatfAssistantProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const isFa = lang === 'fa';
    return [
      {
        id: 'msg-1',
        sender: 'assistant',
        text: isFa 
          ? `سلام! من دستیار هوشمند ارشد استاندارد IATF 16949 و ارزیاب ارشد سیستم‌های مدیریت کیفیت صنعت خودرو هستم. 🚗📋\n\nامروز تمایل دارین در مورد کدام‌یک از ممیزی‌های فرآیند VDA 6.3، ریشه‌یابی خطای 8D، پیاده‌سازی متدهای خطاناشدنی‌سازی (Poka-Yoke) یا تدوین طرح‌های پایش آماری (SPC) مشاوره دریافت کنید؟`
          : `Hello! I am your lead Senior IATF 16949 QMS Auditor and Automotive Quality Systems assistant. 🚗📋\n\nHow can I support you today? Ask me about process audits (VDA 6.3), root-cause analysis (8D), Poka-Yoke techniques, or statistical process control (SPC) schemas!`,
        timestamp: new Date().toLocaleTimeString(isFa ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(getGlobalAiModel());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleModelChange = (e: any) => {
      if (e.detail?.modelId) {
        setSelectedModel(e.detail.modelId);
      }
    };
    window.addEventListener('qms_ai_model_changed', handleModelChange);
    return () => window.removeEventListener('qms_ai_model_changed', handleModelChange);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const isFa = lang === 'fa';

  const quickPrompts = isFa ? [
    {
      title: "ممیزی فرآیند ساخت VDA 6.3",
      prompt: "چگونه ممیزی فرآیند ساخت را بر اساس استاندارد VDA 6.3 در سالن تولید پیاده‌سازی کنیم؟ الگوهای اصلی چیستند؟",
      icon: GraduationCap,
    },
    {
      title: "متد حل مسئله 8D قطعات برگشتی",
      prompt: "یک پاسخ و گام‌های ساختاریافته حل مسئله 8D برای قطعه سگدست شفت که سوراخ رزوه آن ناقص رزوه شده بنویس.",
      icon: Lightbulb,
    },
    {
      title: "خطاناشدنی‌سازی (Poka-Yoke)",
      prompt: "لطفا ۳ ایده عملی خطاناشدنی‌سازی برای خط تولید قطعات مونتاژی دسته سیم خودرو معرفی کن.",
      icon: CheckCircle2,
    },
    {
      title: "تغییر موقت فرآیند بند 8.5.6.1.1",
      prompt: "الزامات ممیزی برای بند 8.5.6.1.1 (تغییرات موقت کنترل‌های فرآیند) چیست و چه مستنداتی لازم دارد؟",
      icon: AlertTriangle,
    }
  ] : [
    {
      title: "VDA 6.3 Process Audits",
      prompt: "How can we implement VDA 6.3 manufacturing process audits in our plant? What are the key elements?",
      icon: GraduationCap,
    },
    {
      title: "8D Problem Solving",
      prompt: "Write a complete 8D root-cause corrective action logic for standard axle shafts experiencing incomplete threading.",
      icon: Lightbulb,
    },
    {
      title: "Poka-Yoke error proofing",
      prompt: "Suggest 3 physical Poka-Yoke mechanisms for testing wiring harness alignment during subassembly.",
      icon: CheckCircle2,
    },
    {
      title: "Temporary Process Changes",
      prompt: "What are the core requirements and checklists for IATF clause 8.5.6.1.1 control lists?",
      icon: AlertTriangle,
    }
  ];

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(isFa ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/iatf-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          model: selectedModel,
          history: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }))
        })
      });

      const data = await response.json();
      
      const assistantText = data.text || (isFa 
        ? "در حال حاضر ارتباط با سرور هوشمند قطع است. لطفا کلید گیمی را در پنل Secrets بررسی نمایید." 
        : "Failed to communicate with AI server. Please verify your GEMINI_API_KEY in Settings > Secrets.");

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: assistantText,
        timestamp: new Date().toLocaleTimeString(isFa ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: `assistant-error-${Date.now()}`,
        sender: 'assistant',
        text: isFa 
          ? "اختلال فنی در شبکه ایجاد شد. لطفاً اتصال سرور و متغیرهای محیطی سیستم را مانیتور کنید." 
          : "A network error occurred. Please monitor server terminal context and check your connection settings.",
        timestamp: new Date().toLocaleTimeString(isFa ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] max-w-6xl mx-auto w-full bg-[#111113] rounded-2xl border border-[#2D2D31] shadow-2xl overflow-hidden">
      {/* Assistant Header */}
      <div className="px-6 py-4 border-b border-[#2D2D31] bg-gradient-to-r from-amber-500/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 border border-amber-500/30">
            <Bot size={22} className="animate-bounce" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">
              {isFa ? "دستیار هوشمند و ارزیاب ارشد سیستم کیفیت IATF" : "AI Senior IATF Quality Systems Consultant"}
            </h2>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              {isFa ? "پاسخگو، هوشمند و متخصص کاتالوگ استاندارد" : "Online - Specialized in QMS requirements"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-400 rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-sm"
            title={isFa ? "راهنمای فعال‌سازی کلید API هوش مصنوعی" : "AI API Key Guide"}
          >
            <KeyRound size={12} className="text-amber-400" />
            <span>{isFa ? "راهنمای کلید API" : "API Key Guide"}</span>
          </button>

          <div className="flex items-center gap-2 bg-[#1A1A1D] px-2.5 py-1 rounded-md text-[10px] text-slate-400 border border-[#232327]">
            <Sparkles size={11} className="text-amber-500 animate-pulse" />
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-slate-300 outline-none cursor-pointer font-sans text-[10px]"
            >
              <option value="gemini-2.5-flash">{isFa ? "Gemini 2.5 Flash" : "Gemini 2.5 Flash"}</option>
              <option value="gemini-2.5-pro">{isFa ? "Gemini 2.5 Pro (پیشرفته)" : "Gemini 2.5 Pro"}</option>
              <option value="gemini-2.0-flash">{isFa ? "Gemini 2.0 Flash" : "Gemini 2.0 Flash"}</option>
              <option value="gemini-2.0-pro-exp">{isFa ? "Gemini 2.0 Pro Exp" : "Gemini 2.0 Pro Exp"}</option>
              <option value="gemini-3.5-flash">{isFa ? "Gemini 3.5 Flash (آخرین ورژن ✨)" : "Gemini 3.5 Flash (Latest)"}</option>
              <option value="gemini-3.1-pro-preview">{isFa ? "Gemini 3.1 Pro" : "Gemini 3.1 Pro"}</option>
              <option value="gemini-3.1-flash-lite">{isFa ? "Gemini 3.1 Lite" : "Gemini 3.1 Lite"}</option>
            </select>
          </div>
          {selectedModel !== 'gemini-3.5-flash' && (
            <button
              onClick={() => setSelectedModel('gemini-3.5-flash')}
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded-md text-[9px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title={isFa ? "ارتقاء فوری به آخرین ورژن در دسترس" : "Upgrade instantly to the latest version"}
            >
              <TrendingUp size={10} className="animate-bounce" />
              <span>{isFa ? "ارتقاء به آخرین ورژن" : "Upgrade to Latest"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Quick Help Prompts Sidebar */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-l md:border-r border-[#2C2C2F] p-4 bg-[#0A0A0B] overflow-y-auto shrink-0 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2 px-1">
            <Sparkles size={12} className="text-amber-500" />
            {isFa ? "پرسش‌های رایج مشاوره‌ای" : "Quick Consultancy Prompts"}
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {quickPrompts.map((qp, index) => (
              <button
                key={index}
                onClick={() => handleSend(qp.prompt)}
                disabled={isLoading}
                className="group p-3 bg-[#131315] hover:bg-amber-500/10 border border-[#232326] hover:border-amber-500/35 rounded-xl transition-all duration-200 text-right cursor-pointer flex flex-col gap-1 text-xs"
              >
                <div className="flex items-center gap-2 text-amber-500 font-bold mb-1">
                  <div className="bg-[#1A1A1D] group-hover:bg-amber-500 group-hover:text-black p-1 rounded-md transition-colors">
                    <qp.icon size={13} />
                  </div>
                  <span className="text-[11px] line-clamp-1">{qp.title}</span>
                </div>
                <p className="text-[10px] text-slate-400 group-hover:text-slate-300 text-right leading-relaxed line-clamp-2">
                  {qp.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0F0F11]">
          {/* Chat Logs */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isUser 
                      ? 'bg-amber-500 border-amber-600/30 text-black' 
                      : 'bg-[#1D1D21] border-[#2C2C2F] text-amber-500'
                  }`}>
                    {isUser ? <User size={13} /> : <Bot size={13} />}
                  </div>

                  {/* Bubble content */}
                  <div className="flex flex-col gap-1">
                    <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap font-sans shadow-md border ${
                      isUser 
                        ? 'bg-[#1E1B17] border-amber-500/20 text-slate-100 rounded-tr-none' 
                        : 'bg-[#121214] border-[#202023] text-slate-300 rounded-tl-none'
                    }`}>
                      {m.text}
                    </div>
                    {/* Timestamp */}
                    <span className={`text-[8px] text-slate-600 font-mono ${isUser ? 'text-left' : 'text-right'}`}>
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3 self-start items-center">
                <div className="w-8 h-8 rounded-lg bg-[#1D1D21] border-[#2C2C2F] text-amber-500 flex items-center justify-center">
                  <Bot size={13} className="animate-spin text-amber-500" />
                </div>
                <div className="bg-[#121214] border-[#202023] px-4 py-2.5 rounded-2xl text-[10px] text-slate-500 border flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                  <span>{isFa ? "دستیار در حال تحلیل مستندات استاندارد..." : "Auditor is reviewing QMS data..."}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-4 border-t border-[#232326] bg-[#0E0E10] flex gap-3 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isFa ? "مشاوره، تفسیر بند، متدهای حل مسئله و ممیزی..." : "Consultation, audit checklists, standard interpretations..."}
              className="flex-1 bg-[#131315] border border-[#252528] focus:border-amber-500/30 rounded-xl px-4 py-3 text-xs text-slate-100 outline-none transition-all placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Send size={13} />
              <span className="hidden sm:inline">{isFa ? "ثبت" : "Send"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Embedded API Key Setup Guide Modal */}
      <AiApiKeyGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
      />
    </div>
  );
}
