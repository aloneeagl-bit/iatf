import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, RotateCcw, Sparkles } from 'lucide-react';

interface MotionGraphicsIntroProps {
  lang: 'fa' | 'en';
  companyName: string;
  logoUrl: string | null;
}

export default function MotionGraphicsIntro({ lang, companyName, logoUrl }: MotionGraphicsIntroProps) {
  const isRtl = lang === 'fa';
  const [animationKey, setAnimationKey] = useState(0);

  // Restart the animation sequence
  const handleReplay = () => {
    setAnimationKey(prev => prev + 1);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-4 select-none">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#111114] to-[#0a0a0c] border border-[#232328] rounded-2xl p-6 sm:p-10 shadow-2xl overflow-hidden">
        
        {/* Subtle grid and decorative glows */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="absolute top-0 left-1/4 w-60 h-60 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-60 h-60 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Action Controls for Replay */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
          <motion.button
            whileHover={{ scale: 1.08, rotate: -45 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReplay}
            className="p-1.5 sm:p-2 bg-[#18181c] hover:bg-[#202026] border border-[#2d2d34] rounded-lg text-slate-400 hover:text-amber-500 transition-colors flex items-center gap-1.5 text-[10px] sm:text-xs font-mono cursor-pointer shadow-md"
            title={isRtl ? 'شروع مجدد انیمیشن' : 'Replay Animation'}
            id="replay-motion-btn"
          >
            <RotateCcw size={12} className="text-amber-500" />
            <span>{isRtl ? 'نمایش مجدد' : 'Replay'}</span>
          </motion.button>
        </div>

        {/* Outer badge indicating premium visual stage */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full">
            <Sparkles size={8} className="animate-pulse" />
            <span>{isRtl ? 'معرفی متحرک' : 'Motion Profile'}</span>
          </div>
        </div>

        {/* Interactive Motion Canvas Stage */}
        <AnimatePresence mode="wait">
          <motion.div
            key={animationKey}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center"
          >
            
            {/* 1. EMBLEM GRAPHIC WITH SPINNING ORBITS & RADIATING IMPACTS */}
            <div className="relative w-48 h-48 flex items-center justify-center mb-6">
              
              {/* Outer Slow Orbit */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotate: -180 }}
                animate={{ 
                  opacity: 0.25, 
                  scale: 1, 
                  rotate: 180,
                  transition: { duration: 1.8, ease: "easeOut" }
                }}
                className="absolute w-44 h-44 border border-dashed border-slate-500 rounded-full pointer-events-none"
                style={{ transformOrigin: 'center' }}
              />

              {/* Fast Accent Orbit Circles with Nodes */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ 
                  opacity: 0.6, 
                  scale: 1,
                  transition: { delay: 0.3, duration: 1.2, ease: "backOut" }
                }}
                className="absolute w-36 h-36 border border-amber-500/20 rounded-full"
              >
                {/* Rolling Node representing continuous feedback (Deming/PDCA loop) */}
                <motion.div
                  animate={{ 
                    rotate: 360,
                    transition: { duration: 6, ease: "linear", repeat: Infinity }
                  }}
                  className="absolute inset-0"
                >
                  <div className="absolute -top-1 left-1/2 w-2.5 h-2.5 bg-amber-500 rounded-full shadow-lg shadow-amber-500/85" />
                  <div className="absolute -bottom-1 left-1/2 w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/85" />
                </motion.div>
              </motion.div>

              {/* Central Glowing Shield / Logo Badge (Larger and of Enhanced Quality) */}
              <motion.div
                initial={{ scale: 0, opacity: 0, rotate: -45 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1, 
                  rotate: 0,
                  transition: { 
                    type: "spring", 
                    stiffness: 90, 
                    damping: 10,
                    delay: 0.5 
                  }
                }}
                whileHover={{ scale: 1.08, transition: { duration: 0.2 } }}
                className="relative w-28 h-28 bg-[#15151a] hover:bg-[#1a1a23] border-2 border-amber-500/80 rounded-3xl p-5 flex items-center justify-center shadow-2xl shadow-amber-500/20 hover:border-amber-500 cursor-pointer z-10 overflow-hidden group"
              >
                {/* Radial internal glow overlay */}
                <div className="absolute inset-0 bg-radial-gradient from-amber-500/15 via-transparent to-transparent group-hover:scale-125 transition-transform duration-500" />
                
                {/* Holographic scanning laser line */}
                <motion.div
                  animate={{ 
                    y: [-55, 75],
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80"
                />

                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="Corporate Logo" 
                    className="w-full h-full object-contain relative z-10 select-none max-h-20 max-w-20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ShieldCheck size={52} className="text-amber-500 relative z-10" />
                )}
              </motion.div>

              {/* Outer pulsing ring impact wave */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: [1, 1.6, 1.9], 
                  opacity: [0.7, 0.4, 0],
                  transition: { 
                    delay: 0.8, 
                    duration: 1.5, 
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 2
                  }
                }}
                className="absolute w-32 h-32 border-2 border-amber-500/40 rounded-full pointer-events-none"
              />
              
              {/* Secondary Blue impact wave */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: [1, 1.4, 1.7], 
                  opacity: [0.6, 0.3, 0],
                  transition: { 
                    delay: 1.3, 
                    duration: 1.5, 
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 2
                  }
                }}
                className="absolute w-32 h-32 border-2 border-blue-500/30 rounded-full pointer-events-none"
              />
            </div>

            {/* 2. STAGGERED REVEALS OF CORPORATE INFORMATION */}

            {/* Company Name Container */}
            <div className="text-center mb-4 z-10">
              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  transition: { delay: 1, duration: 0.6 }
                }}
                className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-wide"
                id="motion-company-title"
              >
                {companyName}
              </motion.h2>
              
              <motion.div
                initial={{ width: 0 }}
                animate={{ 
                  width: "125px",
                  transition: { delay: 1.3, duration: 0.5, ease: "easeOut" }
                }}
                className="h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mt-2"
              />
            </div>

            {/* Corporate Scope / Purpose */}
            <div className="text-center max-w-lg mb-2 px-2">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: 1,
                  transition: { delay: 1.6, duration: 0.8 }
                }}
                className="text-[11px] sm:text-xs uppercase text-amber-500/60 tracking-wider font-extrabold mb-3"
              >
                {isRtl 
                  ? 'شناسنامه اطلاعاتی و تعهدات کیفی پورتال ارزیابی تولید' 
                  : 'Organizational Profile & Operational Excellence Directory'}
              </motion.p>

              <motion.p
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  transition: { delay: 1.8, duration: 0.7, ease: "easeOut" }
                }}
                className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold transition-all duration-300"
              >
                {isRtl 
                  ? 'برنامه توسعه مستمر، مانیتورینگ عدم انطباق، ارتقای فرآیندی و پیوند زنجیره نوین تامین استراتژیک براساس نیازمندی‌های کیفی.' 
                  : 'Continuous progression program, monitoring variances, non-conformities, and strategic supply lifecycle upgrades.'}
              </motion.p>
            </div>

          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}
