import { useState, useCallback } from "react";
import goldenDogLogo from "@/assets/golden-dog-logo-1.png";

interface FloatingElement {
  id: number;
  x: number;
  multiplier: string;
  delay: number;
  colorClass: string;
  glowColor: string;
  particles: Particle[];
}

interface Particle {
  id: number;
  offsetX: number;
  offsetY: number;
  size: number;
  delay: number;
}

const multiplierConfig = [
  { text: "10X", colorClass: "from-green-400 to-emerald-500", glowColor: "0 0 20px rgba(52, 211, 153, 0.8)" },
  { text: "50X", colorClass: "from-blue-400 to-cyan-500", glowColor: "0 0 20px rgba(34, 211, 238, 0.8)" },
  { text: "100X", colorClass: "from-yellow-400 to-orange-500", glowColor: "0 0 25px rgba(251, 191, 36, 0.9)" },
  { text: "500X", colorClass: "from-pink-400 to-rose-500", glowColor: "0 0 25px rgba(251, 113, 133, 0.9)" },
  { text: "1000X", colorClass: "from-purple-400 to-violet-600", glowColor: "0 0 30px rgba(167, 139, 250, 1)" },
  { text: "10000X", colorClass: "from-amber-300 via-yellow-400 to-red-500", glowColor: "0 0 35px rgba(255, 215, 0, 1), 0 0 60px rgba(255, 100, 0, 0.6)" },
];

const generateParticles = (): Particle[] => {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    offsetX: (Math.random() - 0.5) * 60,
    offsetY: (Math.random() - 0.5) * 40,
    size: Math.random() * 6 + 2,
    delay: Math.random() * 0.3,
  }));
};

export const LogoClickEffect = () => {
  const [elements, setElements] = useState<FloatingElement[]>([]);

  const spawnElement = useCallback(() => {
    const id = Date.now() + Math.random();
    const x = Math.random() * 70 + 15;
    const config = multiplierConfig[Math.floor(Math.random() * multiplierConfig.length)];
    const delay = Math.random() * 0.15;

    const newElement: FloatingElement = {
      id,
      x,
      multiplier: config.text,
      delay,
      colorClass: config.colorClass,
      glowColor: config.glowColor,
      particles: generateParticles(),
    };
    
    setElements(prev => [...prev, newElement]);

    setTimeout(() => {
      setElements(prev => prev.filter(el => el.id !== id));
    }, 2800);
  }, []);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute animate-float-up"
            style={{
              left: `${el.x}%`,
              bottom: "-120px",
              animationDelay: `${el.delay}s`,
            }}
          >
            <div className="relative flex flex-col items-center gap-2">
              {/* Particles */}
              {el.particles.map((particle) => (
                <div
                  key={particle.id}
                  className="absolute rounded-full animate-particle-burst"
                  style={{
                    width: particle.size,
                    height: particle.size,
                    left: `calc(50% + ${particle.offsetX}px)`,
                    top: `calc(50% + ${particle.offsetY}px)`,
                    background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))`,
                    boxShadow: el.glowColor,
                    animationDelay: `${particle.delay}s`,
                  }}
                />
              ))}
              
              {/* Logo with glow ring */}
              <div className="relative">
                <div 
                  className="absolute inset-0 rounded-lg animate-pulse-glow"
                  style={{ boxShadow: el.glowColor }}
                />
                <img
                  src={goldenDogLogo}
                  alt="Logo"
                  className="h-14 w-14 rounded-lg object-cover relative z-10 animate-logo-spin"
                />
              </div>
              
              {/* Multiplier text with effects */}
              <div className="relative flex items-center justify-center">
                {/* Background glow */}
                <div 
                  className="absolute inset-0 rounded-md animate-pulse-glow"
                  style={{ 
                    background: `linear-gradient(135deg, ${el.glowColor.includes('rgba') ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.6)'})`,
                    filter: "blur(8px)",
                  }}
                />
                {/* Main text with solid background for clarity */}
                <span 
                  className={`relative px-2 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-white/20 text-base font-black tracking-wide`}
                  style={{ 
                    background: "linear-gradient(135deg, rgba(0,0,0,0.85), rgba(20,20,20,0.9))",
                    boxShadow: el.glowColor,
                  }}
                >
                  <span className={`bg-gradient-to-r ${el.colorClass} bg-clip-text text-transparent`}>
                    {el.multiplier}
                  </span>
                </span>
              </div>

              {/* Rocket flame effect */}
              <div className="relative flex flex-col items-center -mt-1">
                {/* Main flame */}
                <div className="relative">
                  {/* Outer flame (orange/red) */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-10 animate-flame-flicker"
                    style={{
                      background: "linear-gradient(to bottom, rgba(255, 120, 0, 0.9) 0%, rgba(255, 60, 0, 0.7) 40%, rgba(255, 0, 0, 0.4) 70%, transparent 100%)",
                      borderRadius: "50% 50% 50% 50% / 30% 30% 70% 70%",
                      filter: "blur(1px)",
                    }}
                  />
                  {/* Middle flame (yellow) */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-4 h-8 animate-flame-flicker"
                    style={{
                      background: "linear-gradient(to bottom, rgba(255, 255, 100, 1) 0%, rgba(255, 200, 0, 0.9) 30%, rgba(255, 120, 0, 0.6) 60%, transparent 100%)",
                      borderRadius: "50% 50% 50% 50% / 30% 30% 70% 70%",
                      animationDelay: "0.05s",
                    }}
                  />
                  {/* Inner flame (white/blue core) */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-2 h-5 animate-flame-flicker"
                    style={{
                      background: "linear-gradient(to bottom, rgba(200, 230, 255, 1) 0%, rgba(255, 255, 200, 0.9) 40%, rgba(255, 200, 0, 0.5) 80%, transparent 100%)",
                      borderRadius: "50% 50% 50% 50% / 30% 30% 70% 70%",
                      animationDelay: "0.1s",
                    }}
                  />
                  {/* Flame glow */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-8 h-8 -top-2 animate-pulse-glow"
                    style={{
                      background: "radial-gradient(circle, rgba(255, 150, 0, 0.4) 0%, transparent 70%)",
                      filter: "blur(4px)",
                    }}
                  />
                </div>
                {/* Smoke particles */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1">
                  <div 
                    className="w-1.5 h-1.5 rounded-full animate-smoke"
                    style={{ background: "rgba(150, 150, 150, 0.5)", animationDelay: "0s" }}
                  />
                  <div 
                    className="w-1 h-1 rounded-full animate-smoke"
                    style={{ background: "rgba(150, 150, 150, 0.4)", animationDelay: "0.15s" }}
                  />
                  <div 
                    className="w-1.5 h-1.5 rounded-full animate-smoke"
                    style={{ background: "rgba(150, 150, 150, 0.5)", animationDelay: "0.3s" }}
                  />
                </div>
              </div>

              {/* Sparkle effects for high multipliers */}
              {(el.multiplier === "1000X" || el.multiplier === "10000X") && (
                <>
                  <div className="absolute -top-2 -left-2 w-3 h-3 animate-sparkle text-yellow-300">✦</div>
                  <div className="absolute -top-1 -right-3 w-2 h-2 animate-sparkle text-yellow-200" style={{ animationDelay: "0.2s" }}>✧</div>
                  <div className="absolute bottom-12 -right-4 w-2 h-2 animate-sparkle text-orange-300" style={{ animationDelay: "0.4s" }}>✦</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <SpawnTrigger onSpawn={spawnElement} />
    </>
  );
};

const SpawnTrigger = ({ onSpawn }: { onSpawn: () => void }) => {
  if (typeof window !== "undefined") {
    window.spawnLogoEffect = onSpawn;
  }
  return null;
};

export default LogoClickEffect;
