export type RoadCoordinates = [longitude: number, latitude: number];

export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'service'
  | 'track';

export interface RoadNode {
  id: number;
  coordinates: RoadCoordinates;
}

export interface RoadEdge {
  id: number;
  from: number;
  to: number;
  coordinates: RoadCoordinates[];
  distanceMeters: number;
  roadClass: RoadClass;
  oneWay: boolean;
  speedMultiplier: number;
}

export interface RoadNetwork {
  version: number;
  generatedAt: string;
  sourceId: string;
  bounds: [southwest: RoadCoordinates, northeast: RoadCoordinates];
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface NearestRoadResult {
  edgeId: number;
  coordinates: RoadCoordinates;
  distanceMeters: number;
  progress: number;
  roadClass: RoadClass;
  speedMultiplier: number;
  heading: number;
}

export interface RoadContact {
  edge: RoadEdge;
  nearest: NearestRoadResult;
}
