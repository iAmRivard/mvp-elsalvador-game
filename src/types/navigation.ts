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

export interface VehicleOrientation {
  physicalHeading: number;
  recommendedHeading: number | null;
  headingDifference: number | null;
}

export interface RouteHeadingResult {
  heading: number;
  segmentIndex: number;
  distanceToSegmentMeters: number;
  requiresRejoin: boolean;
}

export interface ActiveNavigationState {
  routeSegmentIndex: number;
  recommendedHeading: number;
  maneuverType: NavigationInstructionType;
  maneuverCoordinates: RoadCoordinates;
  distanceToManeuverMeters: number;
  distanceToRouteMeters: number;
  requiresRejoin: boolean;
}
