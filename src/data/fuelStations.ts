export interface FuelStationDefinition {
  id: string;
  name: string;
  coordinates: [longitude: number, latitude: number];
  refuelAmount: number;
  active: boolean;
  chapterAvailability?: string;
}

export const fuelStations: readonly FuelStationDefinition[] = [
  {
    id: 'abastecimiento-san-salvador',
    name: 'Punto de abastecimiento San Salvador',
    coordinates: [-89.193303, 13.699119],
    refuelAmount: 45,
    active: true,
    chapterAvailability: 'chapter-1',
  },
  {
    id: 'abastecimiento-las-delicias',
    name: 'Punto de abastecimiento Las Delicias',
    coordinates: [-89.3175451, 13.6820687],
    refuelAmount: 45,
    active: true,
    chapterAvailability: 'chapter-1',
  },
  {
    id: 'abastecimiento-el-congo',
    name: 'Reserva de combustible El Congo',
    coordinates: [-89.447361, 13.8408999],
    refuelAmount: 45,
    active: true,
    chapterAvailability: 'chapter-1',
  },
] as const;

export const fuelStationById = new Map(
  fuelStations.map((station) => [station.id, station]),
);
