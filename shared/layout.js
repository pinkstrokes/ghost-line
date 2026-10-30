// World layout in meters. y up, GHOST walks from the yard (south, +z) towards the vault (north, -z).
// Shared so the server (creature sim, hazards) and both clients agree on geometry.

export const DIFFICULTY = {
  recruit: { key: 'recruit', label: 'RECRUIT', time: 40 * 60, strikes: 8, escape: 6 * 60, creature: 0.8, blink: 1.25 },
  operative: { key: 'operative', label: 'OPERATIVE', time: 30 * 60, strikes: 5, escape: 5 * 60, creature: 1.0, blink: 1.0 },
  ghost: { key: 'ghost', label: 'GHOST', time: 25 * 60, strikes: 3, escape: 4 * 60, creature: 1.15, blink: 0.85 },
};

export const ZONES = {
  gate: { name: 'GATEHOUSE', x0: -12, x1: 12, z0: 0, z1: 18 },
  lasers: { name: 'LASER HALL', x0: -2, x1: 2, z0: -27, z1: 0, h: 3.2 },
  patch: { name: 'SUBSTATION', x0: -7, x1: 7, z0: -39, z1: -27, h: 4.2 },
  maze: { name: 'UNDERCROFT', x0: -33, x1: -9, z0: -46.5, z1: -28.5, h: 2.5 },
  optics: { name: 'OPTICS LAB', x0: -34, x1: -18, z0: -64, z1: -48.5, h: 6 },
  vault: { name: 'VAULT', x0: -16, x1: -6, z0: -62, z1: -50, h: 4 },
  vaultRoom: { name: 'VAULT', x0: -14, x1: -8, z0: -68, z1: -62, h: 3.4 },
  escape1: { name: 'SERVICE SPINE', x0: -8, x1: 14, z0: -67, z1: -63, h: 3 },
  escape2: { name: 'SERVICE SPINE', x0: 10, x1: 14, z0: -63, z1: -30, h: 3 },
  lift: { name: 'FREIGHT LIFT', x0: 8, x1: 16, z0: -30, z1: -24, h: 3.6 },
};

export const AGENT_SPAWN = { x: 0, z: 14, yaw: 0 };

// Laser hall
export const HALL = { x0: -2, x1: 2, zStart: -3, zEnd: -27, lanes: ['A', 'B', 'C', 'D'], rowLen: 2 };
export const laneX = (lane) => -1.5 + lane; // lane 0..3
export const HALL_CHECKPOINT = { z: -13, zFrom: -12.4, zTo: -13.6 };

// Undercroft maze
export const MAZE = { cols: 8, rows: 6, cell: 3, x0: -33, z0: -46.5, entrance: [7, 4] };
export const cellCenter = (c, r) => ({ x: MAZE.x0 + c * MAZE.cell + MAZE.cell / 2, z: MAZE.z0 + r * MAZE.cell + MAZE.cell / 2 });
export const cellAt = (x, z) => {
  const c = Math.floor((x - MAZE.x0) / MAZE.cell), r = Math.floor((z - MAZE.z0) / MAZE.cell);
  if (c < 0 || r < 0 || c >= MAZE.cols || r >= MAZE.rows) return null;
  return [c, r];
};
export const WALL = { N: 1, E: 2, S: 4, W: 8 };

// Optics lattice: i -> x, j -> z (j grows southwards). One meter per lattice step.
export const OPTICS = { n: 12, x0: -32, z0: -62 };
export const latticePos = (i, j) => ({ x: OPTICS.x0 + i + 0.5, z: OPTICS.z0 + j + 0.5 });
// Direction k: 0 E, 1 NE, 2 N, 3 NW, 4 W, 5 SW, 6 S, 7 SE (north = -z)
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];

// Escape spine hazard grids: 1m cells along each segment.
export const SPINE = [
  { id: 'e1', x0: -8, x1: 14, z0: -67, z1: -63, axis: 'x' },
  { id: 'e2', x0: 10, x1: 14, z0: -63, z1: -30, axis: 'z' },
];
export const BULKHEADS = {
  L1: { x: 3, z: -65, axis: 'x' },
  L2: { x: 12, z: -50, axis: 'z' },
  L3: { x: 12, z: -38, axis: 'z' },
};

export const CAMERAS = [
  // id, position, look-at target, ir capability, ptz, zone
  { id: 'CAM-01', label: 'YARD / SERVICE ENTRY', pos: [-6.5, 4.2, 1.2], look: [2.5, 0.4, 7.5], ir: false, ptz: true, zone: 'gate' },
  { id: 'CAM-02', label: 'HALL 2 / NORTH END', pos: [0, 3.0, -26.6], look: [0, 0.6, -6], ir: true, ptz: false, zone: 'lasers' },
  { id: 'CAM-03', label: 'HALL 2 / SOUTH CORNER', pos: [1.85, 3.05, -0.5], look: [-0.4, 0.4, -16], ir: true, ptz: true, zone: 'lasers' },
  { id: 'CAM-04', label: 'SUBSTATION', pos: [-6.6, 3.9, -27.4], look: [4, 0.8, -35], ir: false, ptz: true, zone: 'patch' },
  { id: 'CAM-05', label: 'UNDERCROFT / BULKHEAD C', pos: [-7.4, 2.3, -31.6], look: [-12, 0.5, -33.6], ir: true, ptz: false, zone: 'maze' },
  { id: 'CAM-06', label: 'OPTICS / CEILING', pos: [-26, 5.85, -56.2], look: [-26, 0, -56.0], ir: true, ptz: false, zone: 'optics', roll: Math.PI / 2, fov: 104 },
  { id: 'CAM-07', label: 'VAULT ANTECHAMBER', pos: [-6.4, 3.7, -50.4], look: [-11, 1, -61], ir: false, ptz: true, zone: 'vault' },
  { id: 'CAM-08', label: 'SPINE / EAST RUN', pos: [-7.6, 2.8, -63.4], look: [8, 0.2, -66], ir: true, ptz: true, zone: 'escape' },
  { id: 'CAM-09', label: 'SPINE / CORNER', pos: [13.7, 2.85, -66.7], look: [11, 0.2, -48], ir: true, ptz: true, zone: 'escape' },
  { id: 'CAM-10', label: 'SPINE / SOUTH RUN', pos: [10.3, 2.85, -30.4], look: [12.5, 0.2, -46], ir: true, ptz: true, zone: 'escape' },
];

export const ZONE_ORDER = ['gate', 'lasers', 'patch', 'maze', 'optics', 'vault', 'escape'];

export function zoneOf(x, z) {
  const inR = (r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  if (z > 0) return 'gate';
  if (inR(ZONES.lasers)) return 'lasers';
  if (inR(ZONES.patch)) return 'patch';
  if (x > -9.2 && x < -6.8 && z > -34.5 && z < -31.5) return 'maze';
  if (inR(ZONES.maze)) return 'maze';
  if (x >= -34 && x <= -18 && z >= -64 && z <= -46.5) return 'optics';
  if (inR(ZONES.vault) || inR(ZONES.vaultRoom) || (x > -18.2 && x < -15.8 && z > -57.5 && z < -54.5)) return 'vault';
  if (inR(ZONES.escape1) || inR(ZONES.escape2) || inR(ZONES.lift)) return 'escape';
  return 'gate';
}
