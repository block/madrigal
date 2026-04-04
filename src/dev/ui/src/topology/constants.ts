import type { TopologyView } from './types';

export const DOMAIN_COLORS: Record<string, string> = {
  voice: '#4f8ff7',
  grammar: '#f59e0b',
  brand: '#ec4899',
  content: '#10b981',
  accessibility: '#8b5cf6',
  ux: '#6366f1',
  design: '#f97316',
  default: '#94a3b8',
};

export const ENFORCEMENT_COLORS: Record<string, string> = {
  must: '#ef4444',
  should: '#f59e0b',
  may: '#3b82f6',
  context: '#8b5cf6',
  deprecated: '#6b7280',
};

export const VIEW_DESCRIPTIONS: Record<TopologyView, string> = {
  centralized: 'All units radiate from the semantic center. Distance = semantic distance from core.',
  decentralized: 'Units cluster into thematic hubs. See which topics bridge between groups.',
  distributed: 'Peer-to-peer similarity. No hierarchy \u2014 just how knowledge naturally relates.',
};

export const ANIMATION_DURATION = 1.0;
export const NODE_BASE_SIZE = 0.12;
export const NODE_HOVER_SCALE = 1.6;
export const MEDOID_SCALE = 1.8;
export const EDGE_OPACITY = 0.15;
export const CAMERA_POSITION: [number, number, number] = [0, 0, 14];
export const CAMERA_FOV = 50;
export const LABEL_FADE_NEAR = 4;
export const LABEL_FADE_FAR = 12;
export const CAMERA_FLY_DURATION = 0.8;
export const CAMERA_FLY_OFFSET = 5;
export const LOD_FAR_THRESHOLD = 12;
export const LOD_NEAR_THRESHOLD = 5;
export const LOD_HYSTERESIS = 0.5;
export const LOD_MID_VISIBLE_COUNT = 15;

export const PARTICLES_PER_NODE = 18;
export const PARTICLE_CLUSTER_RADIUS = 0.12;
export const PARTICLE_BASE_SIZE = 4.0;
export const PARTICLE_COLOR_JITTER = 0.08;
