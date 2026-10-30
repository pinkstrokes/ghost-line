export const fmtTime = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const OBJECTIVES = {
  gate: {
    short: 'GET INSIDE',
    agent: '进入设施：把门禁铭牌上的符号、指示灯颜色和序列号告诉 LINE。',
    handler: 'GHOST 在服务门前。让 GHOST 描述铭牌，用蓝图 A-2 算出门禁码。',
  },
  lasers: {
    short: 'IR GRID',
    agent: '走廊里有你看不见的红外激光网。听 LINE 的：车道 A–D、墙上行号、蹲(C)、跳(空格)。',
    handler: '激光只在 IR 画面里看得见：主屏切到 CAM-02 / CAM-03，按 I 开 IR，一步步指挥 GHOST。',
  },
  patch: {
    short: 'RESTORE POWER',
    agent: '变电室没电。读出配线架编号，按 LINE 的指示把三根跳线插好。',
    handler: '问清配线架编号，在蓝图 E-1 找对应那张图追线；插好后在终端 POWER 里合闸。',
  },
  maze: {
    short: 'UNDERCROFT',
    agent: '地下管廊一片漆黑，里面有东西在听。读墙上的代号和风闸编号；蹲走没有声音。',
    handler: '蓝图 M-1 是管廊图。终端 VENT 开关风闸（同时最多 2 个），SENSORS 看谁在动。',
  },
  optics: {
    short: 'ALIGN OPTICS',
    agent: '光学实验室：镜台上有字母，按 E 顺时针转、Q 逆时针转。光束你看不见。',
    handler: 'CAM-06 俯视 + IR 看光路。两个接收器都要被照到。对照蓝图 O-1 平面图认字母。',
  },
  vault: {
    short: 'CRACK VAULT',
    agent: '读出金库型号牌。按 LINE 说的方向慢慢转盘，报数；LINE 喊停就按 SET。',
    handler: '蓝图 V-1 查型号：方向和真门签名。终端 ACOUSTIC 看示波器，听 GHOST 报数。',
  },
  escape: {
    short: 'ESCAPE',
    agent: '封锁了！浓烟里你什么都看不清。读出闸门上的 4 个符号，跟着 LINE 走。',
    handler: '热成像穿透烟雾：引导 GHOST 绕开坑和电缆。闸门符号用桌上的转盘解，终端 OVERRIDE 输入；最后 LIFT 叫电梯。',
  },
};

export const ZONE_TITLES = {
  gate: 'Z1 GATEHOUSE', lasers: 'Z2 LASER HALL', patch: 'Z3 SUBSTATION', maze: 'Z4 UNDERCROFT', optics: 'Z5 OPTICS LAB', vault: 'Z6 VAULT', escape: 'Z7 LOCKDOWN',
};
