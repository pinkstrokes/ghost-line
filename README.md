# GHOST LINE

两人语音合作潜入游戏。一个人当 **GHOST**，第一人称潜入废弃秘密设施 KESTREL-9；另一个人当 **LINE**，第一人称坐在监控面包车里，手上有设施蓝图、偷接的 CCTV、一台接进楼控系统的终端和一个纸质密码转盘。

GHOST 看得到机关的细节，但不知道怎么解；LINE 知道怎么解、看得到 GHOST 看不到的东西（红外激光、光束、热成像、运动传感器），但动不了。每一关都必须说话。

设计文档：[docs/DESIGN.md](docs/DESIGN.md)

| | |
|---|---|
| ![title](docs/screens/title.png) | ![LINE 的面包车](docs/screens/line-van.png) |
| ![LINE 的 IR 监视器](docs/screens/line-ir-hall.png) | ![LINE 的热成像](docs/screens/line-thermal-spine.png) |
| ![GHOST 在浓烟里读闸门](docs/screens/ghost-smoke.png) | ![示波器](docs/screens/line-scope.png) |
| ![配线架](docs/screens/ghost-patch-frame.png) | ![蓝图 E-1](docs/screens/blueprint-E1.png) |
| ![金库转盘](docs/screens/ghost-vault-dial.png) | ![GHOST 在服务门前](docs/screens/ghost-gate.png) |

## 开始玩

需要 Node.js 20+。

```bash
npm install
npm start
```

启动后终端会打印两个地址：

- 本机：`http://localhost:8080`
- 局域网另一台电脑：`https://<你的局域网IP>:8443`（自签证书，第一次打开要点"继续访问"。浏览器只在 https 下允许用麦克风）

只需要一台电脑跑服务器（自签证书用系统自带的 `openssl` 生成；Windows 上没有 openssl 时 https 会关掉，局域网另一台电脑的游戏内语音就用不了，改用 Discord 即可，游戏本身照常联机）。

一个人点 **建立行动 HOST**，把 4 个字母的行动代码告诉搭档；另一个人输入代码点 **加入行动 JOIN**。两人都点 READY，然后 START。同一台电脑开两个浏览器窗口也能玩（调试或者一个人熟悉两边）。

游戏内对讲：按住 **V** 说话（设置里可以改成常开麦，或者关掉游戏内语音改用 Discord / 面对面）。游戏内语音是两台电脑直连（WebRTC），不经过任何外部服务器，所以只在局域网或同一台电脑上能通；隔着互联网玩请用 Discord 之类的语音，游戏本身照样能联机（需要能访问到这台服务器）。

纸质蓝图：大厅里有"打印这一局的蓝图"链接（`/blueprint.html?seed=…`），可以勾选省墨白底。蓝图随种子变化，旧种子的打印件不能用。

## 操作

**GHOST**：WASD 移动 · 鼠标看 · Shift 跑（有声音）· C 蹲（没声音）· 空格 跳 · F 手电 · E 查看/交互（镜子 E/Q 正反转）· Tab 抬手看表 · V 说话

**LINE**：鼠标转头 · 点击设备凑近 · 右键/Esc 坐回去 · M 监视器 · T 终端 · Tab 蓝图 · V 说话
- 监视器：1–0 选摄像头，I 红外/热成像，方向键或拖动 云台，滚轮 变焦，点小屏换到主屏，P 锁定小屏
- 蓝图：拖动平移，滚轮缩放，Shift+拖动 红笔，Z 撤销，X 擦掉本页，F 适配，1–7 翻页
- 终端：直接打字（HELP 看命令），F1–F6 或 `[` `]` 或点标签切程序
- 密码转盘：拖动或 ←/→ 转内圈

## 七关

| | GHOST | LINE |
|---|---|---|
| Z1 门禁 | 描述铭牌上的 3 个符号、灯色、序列号 | 蓝图 A-2 码表（注意作废的 REV A）+ 校验位流程图 |
| Z2 激光走廊 | 看不见激光，只能听指挥（车道 A–D、行号、蹲、跳） | IR 摄像头看光束和闪烁/扫动时机 |
| Z3 变电室 | 读配线架编号，插三根跳线 | 蓝图 E-1 找对应编号的图追线；终端合闸 |
| Z4 地下管廊 | 黑暗迷宫，读墙上代号，躲怪物 | 蓝图 M-1 + 终端开关风闸（最多同时 2 个）+ 运动传感器 |
| Z5 光学实验室 | 转镜子 | IR 俯视摄像头看光路，两个接收器同时照亮 |
| Z6 金库 | 读型号，转盘报数，SET | 蓝图 V-1 查方向和真门签名，终端示波器 |
| Z7 封锁逃生 | 浓烟里几乎看不见，读闸门符号 | 热成像引路，转盘解闸门码，叫货梯 |

犯错 = 警报 +1，警报满了任务失败；时间到了也失败。三档难度：RECRUIT / OPERATIVE / GHOST。大厅可以选只练某一关。

## 开发

```bash
npm run dev        # Vite (5233) + websocket 服务器 (8091)
npm run verify     # 500 个种子：每关可解性 + 完整任务脚本跑通
node scripts/e2e.mjs http://localhost:5233 /tmp/gl-e2e   # 两个无头浏览器从大厅打到撤离（需要先 npm run dev）
node scripts/sheets.mjs SEED /tmp/sheets                  # 导出 7 张蓝图 PNG
```

结构：`shared/` 是服务器和浏览器共用的纯逻辑（任务生成、房间状态机、光路模拟）；`server/` 是静态文件 + websocket；`src/facility` 设施和 GHOST 视角；`src/zones` 七关；`src/van` 面包车、CCTV、终端、蓝图查看器；`src/blueprint` 蓝图绘制。所有模型、贴图、声音都是代码生成的，没有素材文件，也不调用任何外部 API。
