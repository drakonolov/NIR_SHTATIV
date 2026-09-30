import { Station, TargetPoint, DOPResult, ClockModel, TrajectoryPoint, ObjectiveMetric } from '../types/navigation';

/**
 * Invert a square matrix (3x3 or 4x4) using Gauss-Jordan elimination with partial pivoting.
 * Returns null if matrix is singular or ill-conditioned.
 */
export function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  // Create augmented matrix [A | I]
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    aug[i] = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) {
      aug[i][j] = matrix[i][j];
    }
    aug[i][n + i] = 1.0;
  }

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-11) {
      return null; // Singular matrix
    }

    // Swap rows
    if (maxRow !== col) {
      const temp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = temp;
    }

    // Normalize pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate other rows
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        if (Math.abs(factor) > 1e-14) {
          for (let j = 0; j < 2 * n; j++) {
            aug[row][j] -= factor * aug[col][j];
          }
        }
      }
    }
  }

  // Extract right half
  const inv: number[][] = [];
  for (let i = 0; i < n; i++) {
    inv[i] = [];
    for (let j = 0; j < n; j++) {
      inv[i][j] = aug[i][n + j];
    }
  }

  return inv;
}

/**
 * Calculate condition number approximation using 1-norm for matrix A and A^-1
 */
function estimateConditionNumber(A: number[][], invA: number[][]): number {
  const n = A.length;
  let normA = 0;
  let normInvA = 0;

  for (let j = 0; j < n; j++) {
    let colSumA = 0;
    let colSumInvA = 0;
    for (let i = 0; i < n; i++) {
      colSumA += Math.abs(A[i][j]);
      colSumInvA += Math.abs(invA[i][j]);
    }
    if (colSumA > normA) normA = colSumA;
    if (colSumInvA > normInvA) normInvA = colSumInvA;
  }

  return normA * normInvA;
}

/**
 * Calculate DOP values at a given target point for a list of ground stations.
 * 
 * @param stations List of ground stations
 * @param target Target point coordinates (user/aircraft)
 * @param clockModel '4d_pseudorange' (default GNSS/pseudolite model) or '3d_synchronized'
 * @param elevationMaskDeg Minimum elevation angle in degrees (default 0)
 */
export function calculateDOP(
  stations: Station[],
  target: TargetPoint,
  clockModel: ClockModel = '4d_pseudorange',
  elevationMaskDeg: number = 0
): DOPResult {
  const activeStations = stations.filter(s => s.enabled);
  const minRequired = clockModel === '4d_pseudorange' ? 4 : 3;

  if (activeStations.length < minRequired) {
    return {
      gdop: 99.9,
      pdop: 99.9,
      hdop: 99.9,
      vdop: 99.9,
      tdop: 99.9,
      isSingular: true,
      conditionNumber: Infinity
    };
  }

  const maskRad = (elevationMaskDeg * Math.PI) / 180;
  const G: number[][] = [];

  for (const st of activeStations) {
    const dx = target.x - st.x;
    const dy = target.y - st.y;
    const dz = target.z - st.z;
    const distHoriz = Math.hypot(dx, dy);
    const dist3D = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.1);

    // Elevation angle
    const elevation = Math.atan2(dz, distHoriz);
    if (elevation < maskRad) {
      continue; // Below elevation mask
    }

    // Direction cosines
    const ax = dx / dist3D;
    const ay = dy / dist3D;
    const az = dz / dist3D;

    if (clockModel === '4d_pseudorange') {
      G.push([ax, ay, az, 1.0]);
    } else {
      G.push([ax, ay, az]);
    }
  }

  if (G.length < minRequired) {
    return {
      gdop: 99.9,
      pdop: 99.9,
      hdop: 99.9,
      vdop: 99.9,
      tdop: 99.9,
      isSingular: true,
      conditionNumber: Infinity
    };
  }

  const cols = clockModel === '4d_pseudorange' ? 4 : 3;
  const rows = G.length;

  // Compute A = G^T * G (cols x cols)
  const A: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  for (let c1 = 0; c1 < cols; c1++) {
    for (let c2 = 0; c2 < cols; c2++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        sum += G[r][c1] * G[r][c2];
      }
      A[c1][c2] = sum;
    }
  }

  // Invert A -> Q = (G^T G)^-1
  const Q = invertMatrix(A);

  if (!Q) {
    return {
      gdop: 99.9,
      pdop: 99.9,
      hdop: 99.9,
      vdop: 99.9,
      tdop: 99.9,
      isSingular: true,
      conditionNumber: Infinity
    };
  }

  const cond = estimateConditionNumber(A, Q);

  const qxx = Math.max(0, Q[0][0]);
  const qyy = Math.max(0, Q[1][1]);
  const qzz = Math.max(0, Q[2][2]);
  const qtt = cols === 4 ? Math.max(0, Q[3][3]) : 0;

  const hdop = Math.sqrt(qxx + qyy);
  const vdop = Math.sqrt(qzz);
  const pdop = Math.sqrt(qxx + qyy + qzz);
  const tdop = cols === 4 ? Math.sqrt(qtt) : 0;
  const gdop = Math.sqrt(qxx + qyy + qzz + qtt);

  const isSingular = cond > 1e6 || isNaN(gdop) || !isFinite(gdop) || vdop > 50;

  return {
    gdop: Math.min(isSingular ? 99.9 : gdop, 99.9),
    pdop: Math.min(isSingular ? 99.9 : pdop, 99.9),
    hdop: Math.min(isSingular ? 99.9 : hdop, 99.9),
    vdop: Math.min(isSingular ? 99.9 : vdop, 99.9),
    tdop: Math.min(isSingular ? 99.9 : tdop, 99.9),
    isSingular,
    conditionNumber: cond
  };
}

/**
 * Generate standard Glide Slope trajectory (ICAO standard 3-degree glide slope).
 * Touchdown point is at runway threshold (x = 300m along runway, z = 15m over threshold).
 * Runway extends from x = 0 to x = 3000m.
 * Approach starts at distance 15 km out.
 */
export function generateGlideSlopePoints(
  maxDistanceKm: number = 15,
  stepKm: number = 0.5,
  glideAngleDeg: number = 3.0
): TargetPoint[] {
  const points: TargetPoint[] = [];
  const angleRad = (glideAngleDeg * Math.PI) / 180;
  const thresholdX = 300; // 300m down runway
  const thresholdAlt = 15; // 15m screen height

  let id = 1;
  for (let d = maxDistanceKm; d >= 0; d -= stepKm) {
    const distM = d * 1000;
    // x along approach line: runway points in +X direction.
    // aircraft approaches from negative X towards threshold.
    const x = thresholdX - distM;
    const y = 0; // on runway centerline
    const z = thresholdAlt + distM * Math.tan(angleRad);

    points.push({
      id: id++,
      x,
      y,
      z,
      distanceToTouchdown: d,
      label: d === 0 ? 'Порог ВПП (0 км)' : `${d.toFixed(1)} км`
    });
  }

  return points;
}

/**
 * Generate Runway Box / Terminal Area evaluation points.
 */
export function generateRunwayBoxPoints(): TargetPoint[] {
  const points: TargetPoint[] = [];
  let id = 1;
  // Runway length: 3000m, width 60m
  // Box: -2000m to +5000m in X, -2000m to +2000m in Y
  const xVals = [-2000, -500, 500, 1500, 2500, 3500, 5000];
  const yVals = [-1500, -600, 0, 600, 1500];
  const zVals = [50, 150, 300];

  for (const z of zVals) {
    for (const x of xVals) {
      for (const y of yVals) {
        points.push({
          id: id++,
          x,
          y,
          z,
          label: `(${x},${y},${z})`
        });
      }
    }
  }

  return points;
}

/**
 * Generate 2D/3D Area Grid points (10x10 km area)
 */
export function generateAreaGridPoints(gridSizeKm: number = 10, stepKm: number = 2, altitudeM: number = 200): TargetPoint[] {
  const points: TargetPoint[] = [];
  let id = 1;
  const half = (gridSizeKm * 1000) / 2;
  const stepM = stepKm * 1000;

  for (let x = -half; x <= half; x += stepM) {
    for (let y = -half; y <= half; y += stepM) {
      points.push({
        id: id++,
        x,
        y,
        z: altitudeM,
        label: `${(x / 1000).toFixed(1)}, ${(y / 1000).toFixed(1)}`
      });
    }
  }

  return points;
}

/**
 * Generate low-altitude UAV curved inspection corridor
 */
export function generateUAVCorridorPoints(): TargetPoint[] {
  const points: TargetPoint[] = [];
  let id = 1;
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 to 1
    const x = -5000 + t * 10000;
    // S-curve corridor
    const y = Math.sin(t * Math.PI * 2) * 2000;
    const z = 80 + Math.cos(t * Math.PI) * 40; // 40m to 120m AGL
    points.push({
      id: id++,
      x,
      y,
      z,
      label: `Точка ${i + 1}`
    });
  }
  return points;
}

/**
 * Evaluate objective function over target points given station topology.
 * Lower is better.
 */
export function evaluateObjective(
  stations: Station[],
  targets: TargetPoint[],
  metric: ObjectiveMetric,
  clockModel: ClockModel,
  elevationMaskDeg: number = 0,
  minStationDistanceM: number = 300
): { score: number; maxVdop: number; meanVdop: number; maxHdop: number; maxPdop: number; details: DOPResult[] } {
  let penalty = 0;

  // Proximity penalty: stations should not be on top of each other
  const activeStations = stations.filter(s => s.enabled);
  for (let i = 0; i < activeStations.length; i++) {
    for (let j = i + 1; j < activeStations.length; j++) {
      const d = Math.hypot(
        activeStations[i].x - activeStations[j].x,
        activeStations[i].y - activeStations[j].y,
        activeStations[i].z - activeStations[j].z
      );
      if (d < minStationDistanceM) {
        // quadratic penalty
        penalty += (minStationDistanceM - d) * 0.1;
      }
    }
  }

  const dopList: DOPResult[] = [];
  let maxVdop = 0;
  let sumVdop = 0;
  let maxHdop = 0;
  let maxPdop = 0;
  let sumGdop = 0;

  for (const pt of targets) {
    const res = calculateDOP(stations, pt, clockModel, elevationMaskDeg);
    dopList.push(res);

    if (res.isSingular) {
      penalty += 100;
    }

    if (res.vdop > maxVdop) maxVdop = res.vdop;
    sumVdop += res.vdop;

    if (res.hdop > maxHdop) maxHdop = res.hdop;
    if (res.pdop > maxPdop) maxPdop = res.pdop;
    sumGdop += res.gdop;
  }

  const meanVdop = sumVdop / Math.max(targets.length, 1);
  const meanGdop = sumGdop / Math.max(targets.length, 1);

  let score = 0;
  switch (metric) {
    case 'max_vdop':
      score = maxVdop + penalty;
      break;
    case 'mean_vdop':
      score = meanVdop + penalty;
      break;
    case 'max_pdop':
      score = maxPdop + penalty;
      break;
    case 'mean_gdop':
      score = meanGdop + penalty;
      break;
    case 'composite_vh':
      // 70% VDOP + 30% HDOP as vertical is critical in aviation glide paths
      score = (0.75 * maxVdop + 0.25 * maxHdop) + penalty;
      break;
  }

  return {
    score,
    maxVdop,
    meanVdop,
    maxHdop,
    maxPdop,
    details: dopList
  };
}

/**
 * Generate full trajectory profile with DOP for rendering
 */
export function calculateTrajectoryProfile(
  stations: Station[],
  targets: TargetPoint[],
  clockModel: ClockModel,
  elevationMaskDeg: number = 0
): TrajectoryPoint[] {
  return targets.map((t, idx) => ({
    index: idx,
    distanceKm: t.distanceToTouchdown ?? Math.abs(t.x) / 1000,
    altitudeM: t.z,
    x: t.x,
    y: t.y,
    z: t.z,
    dop: calculateDOP(stations, t, clockModel, elevationMaskDeg)
  }));
}
