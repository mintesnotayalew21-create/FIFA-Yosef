export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GOAL = 'GOAL',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export enum Team {
  HOME = 'HOME', // Blue
  AWAY = 'AWAY'  // Red
}

export enum PlayerRole {
  GK = 'GK',
  DEFENDER = 'DEFENDER',
  MIDFIELDER = 'MIDFIELDER',
  STRIKER = 'STRIKER'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
}

export interface Player extends Entity {
  team: Team;
  role: PlayerRole;
  speed: number;
  control: number;
  power: number;
  hasBall: boolean;
  kickCooldown: number;
  name: string;
  isHuman: boolean;
}

export interface Ball extends Entity {
  friction: number;
  height: number; // 0 is ground, >0 is air
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface MatchStats {
  homeScore: number;
  awayScore: number;
  time: number; // seconds
  possession: number; // percentage
}
