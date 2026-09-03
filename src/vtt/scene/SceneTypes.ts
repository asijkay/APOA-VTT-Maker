export type ID = string;

export type FloorTile = {
  id: ID;
  gridX: number;
  gridY: number;
  elevation: number;
  materialId?: ID;
};

export type Wall = {
  id: ID;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elevation: number;
  blocksVision: boolean;
  blocksMovement: boolean;
};

export type Door = {
  id: ID;
  wallId: ID;
  position: number;
  width: number;
  state: 'open' | 'closed';
  locked: boolean;
  hidden: boolean;
};

export type Window = {
  id: ID;
  wallId: ID;
  position: number; // normalized 0-1 along wall
  width: number;    // world units
};

export type Light = {
  id: ID;
  x: number;
  y: number;
  elevation: number;
  radius: number;
  color: string;
  enabled: boolean;
};

export type Token = {
  id: ID;
  x: number;
  y: number;
  elevation: number;
  radius: number;
  visionRadius: number;
};

export type Scene = {
  floors: FloorTile[];
  walls: Wall[];
  doors: Door[];
  lights: Light[];
  tokens: Token[];
  windows: Window[];
};

export type EditorTool =
  | 'select'
  | 'floor'
  | 'erase-floor'
  | 'wall'
  | 'door'
  | 'window'
  | 'light'
  | 'token';

export function createEmptyScene(): Scene {
  return {
    floors: [],
    walls: [],
    doors: [],
    lights: [],
    tokens: [],
    windows: [],
  };
}
