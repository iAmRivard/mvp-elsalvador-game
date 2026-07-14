export const roadNetworkConfig = {
  dataUrl: '/data/roads/western-corridor.json',
  spatialCellSizeDegrees: 0.0025,
  debugVisible: import.meta.env.VITE_ROAD_DEBUG === 'true',
} as const;
