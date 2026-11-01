export const fmtTime = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const OBJECTIVES = {
  gate: {
    short: 'GET INSIDE',
    agent: 'Get through the service door. Describe the access plate to LINE: the three symbols and the lamp colour. LINE gives you three digits — the fourth is on the notice in the guard booth.',
    handler: 'GHOST is at the service door. Get them to describe the access plate, then work out the first three digits from blueprint A-2. The check digit is GHOST\'s job (guard booth notice).',
  },
  lasers: {
    short: 'IR GRID',
    agent: 'The hall is wired with an infra-red grid you can\'t see. Follow LINE: lanes A–D on the floor, row numbers on the walls. C to crouch, Space to jump.',
    handler: 'The lasers only show up in infra-red (press I on CAM-03 / CAM-02). The gate right in front of GHOST glows — GHOST\'s torch carries IR. CAM-02 looks back, so its left and right are flipped.',
  },
  patch: {
    short: 'RESTORE POWER',
    agent: 'The substation is dead. Read LINE the frame number, then patch the three cables exactly as you\'re told. If the breaker trips, the lamps above the hooks show which cables were right.',
    handler: 'Get the frame number from GHOST, find that frame on blueprint E-1 and trace it. Once GHOST has patched it, close the breaker in the terminal (POWER).',
  },
  maze: {
    short: 'UNDERCROFT',
    agent: 'Pitch dark, and something down here is listening — for footsteps and for your radio. Read out junction codes and damper numbers. Crouch, and keep voices low.',
    handler: 'Blueprint M-1 is the tunnel map. Open and close dampers in the terminal (VENT, two at a time). SENSORS shows what\'s moving — not who. It can hear you on GHOST\'s radio: whisper.',
  },
  optics: {
    short: 'ALIGN OPTICS',
    agent: 'Optics lab. Two wall ports have a blinking amber lamp — read LINE their numbers. Each mirror has a letter: E turns it clockwise, Q anticlockwise. You can\'t see the beam.',
    handler: 'CAM-06 in infra-red shows the beam — but not which ports are live; GHOST can see their lamps. Light both receivers at once. Blueprint O-1 tells you which mirror is which.',
  },
  vault: {
    short: 'CRACK VAULT',
    agent: 'Read LINE the vault\'s model plate. Spin the dial the way LINE says — it drags near every gate. Call out the numbers there, press SET when told.',
    handler: 'Look the model up on blueprint V-1: wheel directions and the true-gate signature. Watch ACOUSTIC in the terminal while GHOST calls numbers.',
  },
  escape: {
    short: 'ESCAPE',
    agent: 'LOCKDOWN. You can barely see through the smoke. Read the four symbols on each bulkhead and follow LINE\'s directions. Listen for clicking behind you.',
    handler: 'Thermal sees through the smoke: steer GHOST around pits and live cables. Solve each bulkhead with the rotor, enter it in OVERRIDE, call the LIFT. If something follows GHOST — whisper.',
  },
};

export const ZONE_TITLES = {
  gate: 'Z1 GATEHOUSE', lasers: 'Z2 LASER HALL', patch: 'Z3 SUBSTATION', maze: 'Z4 UNDERCROFT', optics: 'Z5 OPTICS LAB', vault: 'Z6 VAULT', escape: 'Z7 ESCAPE',
};

// Par: cumulative mission-clock targets for finishing each zone, set for OPERATIVE (30 min) and
// scaled with the difficulty's time limit. Meant to be a little tight — a clean team beats it.
const PAR_S = { gate: 150, lasers: 360, patch: 600, maze: 900, optics: 1170, vault: 1440, escape: 1710 };
export const parFor = (zone, s) => (PAR_S[zone] ?? 0) * 1000 * ((s?.limit || 1800000) / 1800000);
// ms ahead (negative) or behind (positive) the current zone's par; null outside a timed run
export function parDelta(s, now) {
  if (!s || s.phase !== 'playing' || s.practice || !s.startAt || !PAR_S[s.objective]) return null;
  return now - s.startAt - parFor(s.objective, s);
}
export const fmtDelta = (ms) => `${ms > 0 ? '+' : '−'}${fmtTime(Math.abs(ms)).replace(/^0/, '')}`;
