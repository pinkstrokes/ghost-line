export const fmtTime = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const OBJECTIVES = {
  gate: {
    short: 'GET INSIDE',
    agent: 'Get through the service door. Describe the access plate to LINE: the three symbols, the lamp colour, the serial number.',
    handler: 'GHOST is at the service door. Get them to describe the access plate, then work out the code from blueprint A-2.',
  },
  lasers: {
    short: 'IR GRID',
    agent: 'The hall is wired with an infra-red grid you can\'t see. Follow LINE: lanes A–D on the floor, row numbers on the walls. C to crouch, Space to jump.',
    handler: 'The lasers only show up in infra-red. Put CAM-03 / CAM-02 on the main monitor, press I, and talk GHOST through the grid.',
  },
  patch: {
    short: 'RESTORE POWER',
    agent: 'The substation is dead. Read LINE the frame number, then patch the three cables exactly as you\'re told.',
    handler: 'Get the frame number from GHOST, find that frame on blueprint E-1 and trace it. Once GHOST has patched it, close the breaker in the terminal (POWER).',
  },
  maze: {
    short: 'UNDERCROFT',
    agent: 'The tunnels are pitch dark and something in them is listening. Read out the junction codes and damper numbers. Crouching is silent.',
    handler: 'Blueprint M-1 is the tunnel map. Open and close dampers in the terminal (VENT, two at a time). SENSORS shows what\'s moving — not who.',
  },
  optics: {
    short: 'ALIGN OPTICS',
    agent: 'Optics lab. Each mirror has a letter. E turns it clockwise, Q anticlockwise. You can\'t see the beam.',
    handler: 'CAM-06 in infra-red shows the beam from the ceiling. Light both receivers at once. Blueprint O-1 tells you which mirror is which.',
  },
  vault: {
    short: 'CRACK VAULT',
    agent: 'Read LINE the vault\'s model plate. Turn the dial the way LINE says, call out the numbers, press SET when told.',
    handler: 'Look the model up on blueprint V-1: wheel directions and the true-gate signature. Watch ACOUSTIC in the terminal while GHOST calls numbers.',
  },
  escape: {
    short: 'ESCAPE',
    agent: 'LOCKDOWN. You can barely see through the smoke. Read the four symbols on each bulkhead and follow LINE\'s directions.',
    handler: 'Thermal sees through the smoke: steer GHOST around pits and live cables. Solve each bulkhead with the rotor on the desk, enter it in OVERRIDE, then call the LIFT.',
  },
};

export const ZONE_TITLES = {
  gate: 'Z1 GATEHOUSE', lasers: 'Z2 LASER HALL', patch: 'Z3 SUBSTATION', maze: 'Z4 UNDERCROFT', optics: 'Z5 OPTICS LAB', vault: 'Z6 VAULT', escape: 'Z7 LOCKDOWN',
};
