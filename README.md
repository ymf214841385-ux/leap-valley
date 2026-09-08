# 跳跳谷 Leap Valley

皮皮戴着银杏叶帽，在秋天的山坡上奔跑、跳跃、踩甲虫，把丰收风筝送到山顶。

2D 横版平台跳跃，灵感来自经典超级马里奥手感（可变高度跳跃、土狼时间、跳跃缓冲），角色和关卡都是原创的。

## 操作

| 电脑 | 手机 |
| --- | --- |
| A / D 移动 | 左 / 右 |
| 空格 / W / Z 跳跃 | 跳跃 |
| 下落时按住跳跃 = 叶帽滑翔 | 按住跳跃滑翔 |
| ↓ 穿过木板 | 下落 |
| P / Esc 暂停 | 暂停按钮 |

## 玩法

- 三关：银杏坡 → 溪谷桥 → 暮色林
- 踩甲虫、躲开尖刺与飞蛾
- 捡金果，顶开花苞箱
- 蜂蜜罐 = 空中二段跳
- 检查点风筝：掉下去会回到最近落脚处
- 秘叶藏在高处支路

## 本地运行

需要 Node.js 20+。

```bash
npm install
npm run dev
```

浏览器打开终端里提示的地址即可。`npm install` 会自动解开 `packed/` 里的游戏素材到 `public/game/`。

```bash
npm run build
npm run preview
```

进度存在浏览器 localStorage，刷新不会丢。

## 源码结构

| 文件 | 作用 |
| --- | --- |
| `src/game/sim.ts` | 物理、碰撞、踩踏、土狼时间、跳跃缓冲 |
| `src/game/const.ts` | 跳跃高度、重力、速度、生命、计时 |
| `src/game/levels.ts` | 三关瓦片地图 |
| `src/game/render.ts` | 相机、视差、精灵绘制 |
| `src/game/input.ts` | 键盘、手柄、触控 |
| `src/game/game.ts` | 主循环、开局 / 暂停 / 死亡 / 通关 |
| `src/game/audio.ts` | 程序化 Web Audio 音效 |
| `src/game/save.ts` | localStorage 进度 |
| `src/components/game-view.tsx` | 标题、HUD、暂停、触控按钮 |
| `public/game/` | 精灵、瓦片、背景图 |
| `packed/` | 素材打包（gzip + base64 分片） |

改过图片后重新打包：

```bash
npm run pack:assets
```

## 技术

- Canvas 2D + 固定时间步物理
- React 19 / Vite / Tailwind CSS v4 / Zustand
- 素材为原创绘制，没有任天堂版权内容
