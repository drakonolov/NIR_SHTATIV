export interface Station {
  id: number;
  name: string;
  x: number; // meters from runway center / origin
  y: number; // meters
  z: number; // mast height / elevation in meters
  enabled: boolean;
  fixed?: boolean;
  color?: string;
}

export interface TargetPoint {
  id: number;
  x: number;
  y: number;
  z: number;
  label?: string;
  distanceToTouchdown?: number; // km
}

export interface DOPResult {
  gdop: number;
  pdop: number;
  hdop: number;
  vdop: number;
  tdop: number;
  isSingular: boolean;
  conditionNumber: number;
}

export interface TrajectoryPoint {
  index: number;
  distanceKm: number;
  altitudeM: number;
  x: number;
  y: number;
  z: number;
  dop: DOPResult;
}

export type ScenarioType = 'glide_slope' | 'runway_box' | 'area_grid' | 'uav_corridor';

export type ObjectiveMetric = 'max_vdop' | 'mean_vdop' | 'max_pdop' | 'mean_gdop' | 'composite_vh';

export type AlgorithmType = 'hooke_jeeves' | 'pso' | 'ga' | 'nelder_mead' | 'simulated_annealing';

export type ClockModel = '4d_pseudorange' | '3d_synchronized';

export interface BoundaryLimits {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface HookeJeevesConfig {
  initialStep: number;     // e.g. 250 meters
  stepReduction: number;   // alpha reduction factor, e.g. 0.5
  tolerance: number;       // min step size, e.g. 5 meters
  patternFactor: number;   // acceleration move multiplier, e.g. 1.0 or 2.0
  maxIterations: number;   // e.g. 200
  optimizeZ: boolean;      // optimize tower height / elevation
}

export interface OptimizationStepLog {
  iteration: number;
  stepType: 'explore' | 'pattern' | 'shrink' | 'init' | 'converged';
  description: string;
  bestValue: number;
  currentStepSize: number;
  evaluations: number;
  stations: Station[];
  probedPoints?: { stationIdx: number; x: number; y: number; z: number; value: number }[];
}

export interface BenchmarkResult {
  algorithm: AlgorithmType;
  algorithmName: string;
  executionTimeMs: number;
  evaluations: number;
  iterations: number;
  initialMetric: number;
  finalMetric: number;
  improvementPercent: number;
  maxVdop: number;
  meanVdop: number;
  maxHdop: number;
  converged: boolean;
  stations: Station[];
  convergenceHistory: { iteration: number; value: number }[];
}
