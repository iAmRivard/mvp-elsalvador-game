import type { RoadCoordinates } from './roads';

export type NavigationInstructionType =
  | 'continue'
  | 'turn-left'
  | 'turn-right'
  | 'slight-left'
  | 'slight-right'
  | 'u-turn'
  | 'arrive';

export interface NavigationInstruction {
  type: NavigationInstructionType;
  coordinates: RoadCoordinates;
  distanceFromPreviousMeters: number;
  text: string;
}

export interface RouteNavigationInstruction extends NavigationInstruction {
  distanceFromRouteStartMeters: number;
  routeCoordinateIndex: number;
}
