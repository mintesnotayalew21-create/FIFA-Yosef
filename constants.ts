export const FIELD_WIDTH = 1200;
export const FIELD_HEIGHT = 800;
export const GOAL_WIDTH = 200;
export const PLAYER_RADIUS = 18;
export const BALL_RADIUS = 8;
export const GAME_DURATION = 90 * 2; // scaled minutes
export const FPS = 60;

export const COLORS = {
  FIELD_GRASS: '#4ade80', // Tailwind green-400
  FIELD_LINES: 'rgba(255, 255, 255, 0.8)',
  HOME_KIT: '#3b82f6', // Blue-500
  HOME_KIT_TRIM: '#1d4ed8',
  AWAY_KIT: '#ef4444', // Red-500
  AWAY_KIT_TRIM: '#b91c1c',
  BALL: '#ffffff',
  TEXT_UI: '#f8fafc'
};

// Physics
export const FRICTION = 0.97;
export const PLAYER_ACCEL = 0.8;
export const PLAYER_MAX_SPEED = 6;
export const KICK_POWER = 18;
export const BALL_ELASTICITY = 0.7;
