# Rouge 斗地主 Roguelike (Web MVP)

基于 `React + TypeScript + Vite` 的单机 PVE 网页版 MVP。

## 当前实现

- 单机 PVE 短流程 Run（3-5 战）
- 斗地主拼点战斗循环（攻击/防守/反压/要不起）
- 完整牌型识别与压制规则：
  - 单张 / 一对 / 三不带 / 三带一 / 三带一对
  - 顺子 / 连对 / 四带二 / 飞机 / 炸弹 / 王炸
- 手牌上限 10，战后自动补牌，牌库空时弃牌回洗
- 单层启发式敌人 AI
- 轻量奖励阶段（回血/加最大生命/伤害倍率）
- 本地存档（`localStorage`）与设置（音量、动画速度）
- 桌面优先、移动端可玩 UI

## 项目结构

- `src/engine`: 规则引擎、回合结算、AI
- `src/store`: Zustand 状态管理
- `src/app`: 主页面与流程组件
- `src/ui/components`: UI 组件
- `src/lib`: 存档与工具
- `src/data`: 敌人数据

## 快速开始

```bash
npm install
npm run dev
```

默认地址：`http://localhost:5173`

## 质量检查

```bash
npm run lint
npm run test
npm run build
```

## 部署到 Vercel（免费）

1. 将仓库推送到 GitHub。
2. 登录 Vercel，导入该仓库。
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. 部署后即可获得公开访问链接。

## 旧 Demo

原始单文件 Demo 仍保留在仓库根目录：`Doudizhu.html`。
