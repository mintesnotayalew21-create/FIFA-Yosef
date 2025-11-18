import React, { useState, useEffect } from 'react';
import { X, MessageCircle, PlayCircle, MousePointer2, Keyboard } from 'lucide-react';

interface AssistantProps {
  onClose: () => void;
  mode: 'intro' | 'gameplay';
}

const Assistant: React.FC<AssistantProps> = ({ onClose, mode }) => {
  const [step, setStep] = useState(0);

  const introSteps = [
    {
      text: "Hola! I'm Leo, your assistant. Welcome to Pro Striker 2026. I'll help you become a champion!",
      icon: <MessageCircle className="w-6 h-6 text-yellow-400" />
    },
    {
      text: "This game simulates professional football. You need strategy, timing, and speed.",
      icon: <PlayCircle className="w-6 h-6 text-yellow-400" />
    }
  ];

  const gameplaySteps = [
    {
      text: "Let's talk controls! On Desktop, use WASD or Arrow Keys to move your player.",
      icon: <Keyboard className="w-6 h-6 text-blue-400" />
    },
    {
      text: "Press SPACE to Shoot and SHIFT to Sprint. On Mobile? Use the on-screen joystick!",
      icon: <MousePointer2 className="w-6 h-6 text-green-400" />
    },
    {
      text: "Tip: Pass the ball to open teammates. Don't just run alone!",
      icon: <MessageCircle className="w-6 h-6 text-yellow-400" />
    }
  ];

  const currentSteps = mode === 'intro' ? introSteps : gameplaySteps;

  const handleNext = () => {
    if (step < currentSteps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      
      <div className="pointer-events-auto relative bg-slate-900 border border-slate-700 p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full m-0 sm:m-6 flex flex-col gap-4 animate-slide-up">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Header with 'Leo' Image */}
        <div className="flex items-center gap-4">
          <div className="relative">
             {/* Placeholder for a star player image */}
            <img 
              src="https://picsum.photos/id/1005/80/80" 
              alt="Leo Assistant" 
              className="w-20 h-20 rounded-full border-4 border-yellow-500 object-cover shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
              PRO
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Leo's Tips</h3>
            <p className="text-slate-400 text-sm">Professional Assistant</p>
          </div>
        </div>

        {/* Dialogue Box */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 min-h-[100px] flex items-start gap-3">
          <div className="mt-1 flex-shrink-0">
            {currentSteps[step].icon}
          </div>
          <p className="text-slate-200 leading-relaxed text-lg">
            {currentSteps[step].text}
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-1">
            {currentSteps.map((_, i) => (
              <div 
                key={i} 
                className={`h-2 w-2 rounded-full transition-colors ${i === step ? 'bg-yellow-500' : 'bg-slate-700'}`} 
              />
            ))}
          </div>
          <button 
            onClick={handleNext}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-full transition-transform active:scale-95 shadow-lg shadow-blue-900/20"
          >
            {step === currentSteps.length - 1 ? "Let's Play!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
