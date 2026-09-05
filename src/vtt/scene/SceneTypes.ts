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
  swingDirection?: 1 | -1;
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
  ownerId?: string;
  name?: string;
  imageUrl?: string;
  hidden?: boolean;
};

export type MapImage = {
  id: ID;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  locked: boolean;
};

export type Scene = {
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
  floors: FloorTile[];
  walls: Wall[];
  doors: Door[];
  lights: Light[];
  tokens: Token[];
  windows: Window[];
  images: MapImage[];
};

export type EditorTool =
  | 'select'
  | 'floor'
  | 'erase-floor'
  | 'wall'
  | 'door'
  | 'window'
  | 'light'
  | 'token'
  | 'image'
  | 'ruler';

export function createEmptyScene(): Scene {
  return {
    gridSize: 25,
    mapWidth: 25,
    mapHeight: 25,
    floors: [],
    walls: [],
    doors: [],
    lights: [],
    tokens: [],
    windows: [],
    images: [],
  };
}
