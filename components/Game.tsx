import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  FIELD_WIDTH, FIELD_HEIGHT, PLAYER_RADIUS, BALL_RADIUS, COLORS, 
  FRICTION, PLAYER_ACCEL, PLAYER_MAX_SPEED, KICK_POWER, GOAL_WIDTH, 
  GAME_DURATION 
} from '../constants';
import { 
  GameState, Team, PlayerRole, Entity, Player, Ball, Vector2, Particle 
} from '../types';
import { audioService } from '../services/audioService';
import Assistant from './Assistant';
import { Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';

// --- Helper Math ---
const dist = (v1: Vector2, v2: Vector2) => Math.hypot(v1.x - v2.x, v1.y - v2.y);
const normalize = (v: Vector2) => {
  const m = Math.hypot(v.x, v.y);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fixed: Initialize with null to satisfy stricter explicit argument requirements
  const requestRef = useRef<number | null>(null);
  
  // Game State Refs (Mutable for performance)
  const playersRef = useRef<Player[]>([]);
  const ballRef = useRef<Ball>({ id: 'ball', pos: { x: FIELD_WIDTH/2, y: FIELD_HEIGHT/2 }, vel: { x: 0, y: 0 }, radius: BALL_RADIUS, friction: 0.98, height: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // React State for UI
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [scores, setScores] = useState({ home: 0, away: 0 });
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [showAssistant, setShowAssistant] = useState(true);
  const [assistantMode, setAssistantMode] = useState<'intro' | 'gameplay'>('intro');
  const [isMuted, setIsMuted] = useState(false);

  // --- Initialization ---
  const initGame = useCallback(() => {
    const newPlayers: Player[] = [];
    
    // Helper to create team
    const createTeam = (team: Team, startX: number, dir: number) => {
      const roles = [PlayerRole.GK, PlayerRole.DEFENDER, PlayerRole.DEFENDER, PlayerRole.MIDFIELDER, PlayerRole.STRIKER];
      const positions = [
        { x: startX, y: FIELD_HEIGHT / 2 }, // GK
        { x: startX + 150 * dir, y: FIELD_HEIGHT / 3 },
        { x: startX + 150 * dir, y: (FIELD_HEIGHT / 3) * 2 },
        { x: startX + 300 * dir, y: FIELD_HEIGHT / 2 },
        { x: startX + 450 * dir, y: FIELD_HEIGHT / 2 },
      ];

      roles.forEach((role, i) => {
        newPlayers.push({
          id: `${team}-${role}-${i}`,
          team,
          role,
          pos: { x: positions[i].x, y: positions[i].y },
          vel: { x: 0, y: 0 },
          radius: PLAYER_RADIUS,
          speed: role === PlayerRole.STRIKER ? 1.1 : 1.0,
          control: 1.0,
          power: 1.0,
          hasBall: false,
          kickCooldown: 0,
          name: `${team} ${role}`,
          isHuman: team === Team.HOME && i === 4 // Start controlling striker
        });
      });
    };

    createTeam(Team.HOME, 100, 1);
    createTeam(Team.AWAY, FIELD_WIDTH - 100, -1);

    playersRef.current = newPlayers;
    ballRef.current = { 
      id: 'ball', 
      pos: { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 }, 
      vel: { x: 0, y: 0 }, 
      radius: BALL_RADIUS, 
      friction: FRICTION, 
      height: 0 
    };
    setScores({ home: 0, away: 0 });
    setTimeLeft(GAME_DURATION);
    setGameState(GameState.PLAYING);
    audioService.playWhistle();
  }, []);

  // --- Game Loop Logic ---
  const update = () => {
    if (gameState !== GameState.PLAYING) return;

    const ball = ballRef.current;
    const players = playersRef.current;

    // 1. Update Ball
    ball.pos.x += ball.vel.x;
    ball.pos.y += ball.vel.y;
    ball.vel.x *= ball.friction;
    ball.vel.y *= ball.friction;

    // Ball collision with walls (simple bounce)
    if (ball.pos.y < 0 || ball.pos.y > FIELD_HEIGHT) ball.vel.y *= -1;
    if (ball.pos.x < 0 || ball.pos.x > FIELD_WIDTH) {
       // Check Goal
       if (ball.pos.y > FIELD_HEIGHT/2 - GOAL_WIDTH/2 && ball.pos.y < FIELD_HEIGHT/2 + GOAL_WIDTH/2) {
          handleGoal(ball.pos.x < 0 ? Team.AWAY : Team.HOME);
          return; // Stop update for reset
       } else {
          ball.vel.x *= -1;
       }
    }

    // 2. Update Players
    let humanPlayer = players.find(p => p.isHuman);
    
    // Auto-switch human player to closest to ball if not currently controlling ball
    if (!humanPlayer?.hasBall) {
       let closestDist = Infinity;
       let closestPlayer = humanPlayer;
       players.filter(p => p.team === Team.HOME).forEach(p => {
          const d = dist(p.pos, ball.pos);
          if (d < closestDist) {
             closestDist = d;
             closestPlayer = p;
          }
       });
       if (closestPlayer && humanPlayer && closestPlayer.id !== humanPlayer.id) {
          players.forEach(p => p.isHuman = false);
          closestPlayer.isHuman = true;
          humanPlayer = closestPlayer;
       }
    }

    players.forEach(player => {
      // Controls or AI
      let ax = 0; 
      let ay = 0;

      if (player.isHuman) {
        if (keysRef.current['ArrowUp'] || keysRef.current['w']) ay = -1;
        if (keysRef.current['ArrowDown'] || keysRef.current['s']) ay = 1;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a']) ax = -1;
        if (keysRef.current['ArrowRight'] || keysRef.current['d']) ax = 1;

        // Kick
        if (keysRef.current[' ']) { // Space
           if (player.hasBall) kickBall(player);
        }
      } else {
        // Simple AI
        // Target: Ball if close, or defensive position
        let target = ball.pos;
        
        // If teammate has ball, move forward
        const teammateHasBall = players.some(p => p.team === player.team && p.hasBall);
        
        if (teammateHasBall) {
           target = { x: player.team === Team.HOME ? player.pos.x + 100 : player.pos.x - 100, y: player.pos.y };
        } else if (player.role === PlayerRole.GK) {
           // GK tracks ball Y but stays near goal X
           target = { 
             x: player.team === Team.HOME ? 50 : FIELD_WIDTH - 50, 
             y: Math.max(FIELD_HEIGHT/2 - 100, Math.min(FIELD_HEIGHT/2 + 100, ball.pos.y)) 
           };
        }

        const dir = normalize({ x: target.x - player.pos.x, y: target.y - player.pos.y });
        // AI speed factor
        const aiSpeed = player.hasBall ? 0.8 : 0.9; // Dribbling is slower
        ax = dir.x * aiSpeed;
        ay = dir.y * aiSpeed;

        // AI Shoot if close to goal
        if (player.hasBall) {
           const distToGoal = player.team === Team.HOME ? dist(player.pos, {x: FIELD_WIDTH, y: FIELD_HEIGHT/2}) : dist(player.pos, {x: 0, y: FIELD_HEIGHT/2});
           if (distToGoal < 250 && Math.random() < 0.05) {
              kickBall(player);
           }
        }
      }

      // Physics
      player.vel.x += ax * PLAYER_ACCEL;
      player.vel.y += ay * PLAYER_ACCEL;
      
      // Cap Speed
      const currentSpeed = Math.hypot(player.vel.x, player.vel.y);
      const maxSpd = (keysRef.current['Shift'] && player.isHuman) ? PLAYER_MAX_SPEED * 1.2 : PLAYER_MAX_SPEED;
      
      if (currentSpeed > maxSpd) {
        player.vel.x = (player.vel.x / currentSpeed) * maxSpd;
        player.vel.y = (player.vel.y / currentSpeed) * maxSpd;
      }

      // Apply velocity
      player.pos.x += player.vel.x;
      player.pos.y += player.vel.y;
      
      // Friction
      player.vel.x *= 0.9;
      player.vel.y *= 0.9;

      // Boundaries
      player.pos.x = Math.max(PLAYER_RADIUS, Math.min(FIELD_WIDTH - PLAYER_RADIUS, player.pos.x));
      player.pos.y = Math.max(PLAYER_RADIUS, Math.min(FIELD_HEIGHT - PLAYER_RADIUS, player.pos.y));

      // Ball Interaction
      if (dist(player.pos, ball.pos) < PLAYER_RADIUS + BALL_RADIUS) {
        if (!player.hasBall && player.kickCooldown <= 0) {
           // Take possession
           // Force others to drop ball
           players.forEach(p => p.hasBall = false);
           player.hasBall = true;
        }
      }

      if (player.hasBall) {
        // Dribble logic: Keep ball in front
        ball.pos.x = player.pos.x + player.vel.x * 2;
        ball.pos.y = player.pos.y + player.vel.y * 2;
        ball.vel = { x: player.vel.x, y: player.vel.y };
      }
      
      if (player.kickCooldown > 0) player.kickCooldown--;
    });

    // 3. Update Particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
    });

    // Time
    setTimeLeft(prev => {
      if (prev <= 0) {
        setGameState(GameState.GAME_OVER);
        audioService.playWhistle();
        return 0;
      }
      return prev - (1/60); // Realtime minutes approx
    });
  };

  const kickBall = (player: Player) => {
    const ball = ballRef.current;
    player.hasBall = false;
    player.kickCooldown = 30;

    const targetX = player.team === Team.HOME ? FIELD_WIDTH : 0;
    const targetY = FIELD_HEIGHT / 2; // Aim for center goal roughly
    
    // Add noise to shot based on movement
    let dir = normalize({ x: targetX - player.pos.x, y: targetY - player.pos.y });
    
    if (player.isHuman) {
       // Human shoots in direction of movement or facing
       if (Math.hypot(player.vel.x, player.vel.y) > 0.1) {
         dir = normalize(player.vel);
       }
    }

    ball.vel.x = dir.x * KICK_POWER;
    ball.vel.y = dir.y * KICK_POWER;
    
    audioService.playKick();
    
    // Create particles
    for(let i=0; i<5; i++) {
      particlesRef.current.push({
        x: ball.pos.x,
        y: ball.pos.y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1.0,
        color: '#ffffff'
      });
    }
  };

  const handleGoal = (scoringTeam: Team) => {
    audioService.playGoal();
    setScores(prev => ({
      ...prev,
      [scoringTeam === Team.HOME ? 'home' : 'away']: prev[scoringTeam === Team.HOME ? 'home' : 'away'] + 1
    }));
    
    setGameState(GameState.GOAL);
    
    // Reset after delay
    setTimeout(() => {
      ballRef.current.pos = { x: FIELD_WIDTH/2, y: FIELD_HEIGHT/2 };
      ballRef.current.vel = { x: 0, y: 0 };
      playersRef.current.forEach(p => {
         // Reset positions roughly
         const dir = p.team === Team.HOME ? 1 : -1;
         p.hasBall = false;
         p.vel = {x:0, y:0};
         if (p.role === PlayerRole.GK) p.pos = {x: p.team === Team.HOME ? 100 : FIELD_WIDTH-100, y: FIELD_HEIGHT/2};
         // Others reset... simplified for now
         p.pos.x += (p.team === Team.HOME ? -50 : 50); 
      });
      setGameState(GameState.PLAYING);
    }, 2000);
  };

  // --- Render Loop ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    // Clear
    ctx.fillStyle = COLORS.FIELD_GRASS;
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    // Draw Field Lines
    ctx.strokeStyle = COLORS.FIELD_LINES;
    ctx.lineWidth = 2;
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(FIELD_WIDTH/2, 0);
    ctx.lineTo(FIELD_WIDTH/2, FIELD_HEIGHT);
    ctx.stroke();
    
    // Center Circle
    ctx.beginPath();
    ctx.arc(FIELD_WIDTH/2, FIELD_HEIGHT/2, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Goals
    ctx.strokeRect(0, FIELD_HEIGHT/2 - GOAL_WIDTH/2, 60, GOAL_WIDTH);
    ctx.strokeRect(FIELD_WIDTH - 60, FIELD_HEIGHT/2 - GOAL_WIDTH/2, 60, GOAL_WIDTH);

    // Particles
    particlesRef.current.forEach(p => {
       ctx.globalAlpha = p.life;
       ctx.fillStyle = p.color;
       ctx.beginPath();
       ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
       ctx.fill();
       ctx.globalAlpha = 1.0;
    });

    // Players
    playersRef.current.forEach(p => {
       ctx.fillStyle = p.team === Team.HOME ? COLORS.HOME_KIT : COLORS.AWAY_KIT;
       ctx.beginPath();
       ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
       ctx.fill();
       
       // Ring for player highlight
       if (p.isHuman) {
         ctx.strokeStyle = '#fbbf24'; // Amber
         ctx.lineWidth = 3;
         ctx.stroke();
       } else {
         // Trim
         ctx.strokeStyle = p.team === Team.HOME ? COLORS.HOME_KIT_TRIM : COLORS.AWAY_KIT_TRIM;
         ctx.lineWidth = 2;
         ctx.stroke();
       }

       // Number/Role text (simplified)
       ctx.fillStyle = '#fff';
       ctx.font = '10px Arial';
       ctx.textAlign = 'center';
       // ctx.fillText(p.role[0], p.pos.x, p.pos.y + 4);
    });

    // Ball
    const ball = ballRef.current;
    ctx.fillStyle = COLORS.BALL;
    ctx.beginPath();
    ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const loop = () => {
    update();
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Scaling for responsiveness
        const scale = Math.min(window.innerWidth / FIELD_WIDTH, window.innerHeight / FIELD_HEIGHT) * 0.95;
        ctx.setTransform(scale, 0, 0, scale, (canvasRef.current.width - FIELD_WIDTH * scale)/2, (canvasRef.current.height - FIELD_HEIGHT * scale)/2);
        draw(ctx);
      }
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    // Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key] = false;
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Start Loop
    requestRef.current = requestAnimationFrame(loop);
    
    // Canvas Resizing
    const handleResize = () => {
       if (canvasRef.current) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
       }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  // --- Handlers ---
  const togglePause = () => {
    setGameState(prev => prev === GameState.PLAYING ? GameState.PAUSED : GameState.PLAYING);
  };

  const toggleMute = () => {
      const muted = audioService.toggleMute();
      setIsMuted(muted);
  };

  const restartGame = () => {
    initGame();
  };

  // Initial Start
  useEffect(() => {
     if (gameState === GameState.MENU) {
        // Wait for user interaction in MainMenu
     }
  }, [gameState]);


  // Start Game Helper (Passed to button)
  const handleStart = () => {
     audioService.init();
     audioService.startBGM();
     initGame();
     setAssistantMode('gameplay');
     setShowAssistant(true);
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden flex flex-col items-center justify-center font-sans">
      
      {/* --- GAME CANVAS --- */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* --- UI LAYER --- */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-slate-900 text-white">
          <div className="mb-8 text-center">
            <h1 className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-blue-400 drop-shadow-lg">
              PRO STRIKER
            </h1>
            <h2 className="text-4xl font-bold text-blue-500 mt-2">2026</h2>
            <p className="text-slate-400 mt-4 text-lg tracking-wide uppercase">Ultimate Football Simulation</p>
          </div>
          
          <button 
            onClick={() => {
                handleStart();
            }}
            className="group relative px-12 py-4 bg-blue-600 rounded-full font-bold text-xl shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:bg-blue-500 hover:shadow-[0_0_40px_rgba(37,99,235,0.8)] transition-all duration-300 transform hover:scale-105"
          >
             <span className="flex items-center gap-3">
               <Play size={28} fill="currentColor" />
               KICK OFF
             </span>
          </button>
          
          <button 
             onClick={() => setShowAssistant(true)}
             className="mt-6 text-slate-400 hover:text-white underline underline-offset-4 text-sm"
          >
             Need Help? Ask Leo
          </button>

          <div className="absolute bottom-8 text-slate-600 text-xs">
            v1.0.0 • Powered by React Engine • No Assets Required
          </div>
        </div>
      )}

      {/* --- HUD --- */}
      {gameState !== GameState.MENU && (
        <>
          {/* Scoreboard */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 bg-slate-900/80 backdrop-blur-md px-8 py-3 rounded-2xl border border-slate-700 shadow-2xl">
             <div className="text-center">
                <span className="block text-3xl font-bold text-blue-500">{scores.home}</span>
                <span className="text-xs text-slate-400 font-bold">HOME</span>
             </div>
             <div className="flex flex-col items-center px-4 border-x border-slate-700">
                <span className="text-2xl font-mono font-bold text-white">
                   {Math.floor(GAME_DURATION - timeLeft)}'
                </span>
             </div>
             <div className="text-center">
                <span className="block text-3xl font-bold text-red-500">{scores.away}</span>
                <span className="text-xs text-slate-400 font-bold">AWAY</span>
             </div>
          </div>

          {/* Controls / Stats Corner */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button onClick={toggleMute} className="p-2 bg-slate-800/80 rounded-lg text-white hover:bg-slate-700">
               {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
            </button>
            <button onClick={togglePause} className="p-2 bg-slate-800/80 rounded-lg text-white hover:bg-slate-700">
               {gameState === GameState.PAUSED ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <button onClick={restartGame} className="p-2 bg-slate-800/80 rounded-lg text-white hover:bg-slate-700">
               <RefreshCw size={20} />
            </button>
          </div>

          {/* GOAL BANNER */}
          {gameState === GameState.GOAL && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 animate-in fade-in duration-300">
               <h1 className="text-9xl font-black text-yellow-400 drop-shadow-[0_10px_20px_rgba(234,179,8,0.5)] animate-bounce">
                 GOAL!
               </h1>
            </div>
          )}

          {/* GAME OVER BANNER */}
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/90">
               <h1 className="text-6xl font-bold text-white mb-4">FULL TIME</h1>
               <div className="text-4xl text-blue-400 mb-8">
                 {scores.home} - {scores.away}
               </div>
               <button 
                 onClick={restartGame}
                 className="px-8 py-3 bg-white text-slate-900 font-bold rounded-full hover:bg-gray-200 transition-colors"
               >
                 Play Again
               </button>
            </div>
          )}
        </>
      )}

      {/* --- ASSISTANT --- */}
      {showAssistant && (
        <Assistant 
          mode={assistantMode} 
          onClose={() => setShowAssistant(false)} 
        />
      )}

      {/* --- MOBILE CONTROLS (Visible only on touch devices theoretically, but keeping hidden for desktop cleanliness unless requested, or show as hint) --- */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:block text-white/50 text-xs font-mono pointer-events-none">
        CONTROLS: WASD (Move) | SPACE (Kick) | SHIFT (Sprint)
      </div>
      <div className="absolute bottom-4 right-4 z-10 sm:hidden flex gap-4">
         {/* Placeholder for virtual joystick area */}
         <div className="w-32 h-32 bg-white/10 rounded-full border border-white/20 flex items-center justify-center">
           <span className="text-white/50 text-xs">MOVE</span>
         </div>
         <div className="flex flex-col gap-2 justify-end">
           <button 
              className="w-16 h-16 bg-red-500/80 rounded-full text-white font-bold active:scale-95"
              onTouchStart={() => keysRef.current[' '] = true}
              onTouchEnd={() => keysRef.current[' '] = false}
            >SHOOT</button>
           <button 
              className="w-12 h-12 bg-blue-500/80 rounded-full text-white text-xs font-bold active:scale-95"
              onTouchStart={() => keysRef.current['Shift'] = true}
              onTouchEnd={() => keysRef.current['Shift'] = false}
           >RUN</button>
         </div>
      </div>
    </div>
  );
};

export default Game;