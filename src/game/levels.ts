import { MAP_H } from "./const";

export type MoverDef = {
  x: number;
  y: number;
  w: number;
  range: number;
  speed: number;
  axis: "x" | "y";
};

export type LevelDef = {
  id: number;
  name: string;
  nameEn: string;
  dusk: boolean;
  time: number;
  grid: string[];
  movers: MoverDef[];
};

type Api = {
  w: number;
  set: (x: number, y: number, ch: string) => void;
  ground: (x0: number, x1: number) => void;
  plat: (x: number, y: number, len: number, ch?: string) => void;
  coins: (x: number, y: number, n: number) => void;
};

function build(w: number, paint: (api: Api) => void): string[] {
  const cells = Array.from({ length: MAP_H }, () => Array.from({ length: w }, () => " "));
  const set = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < w && y >= 0 && y < MAP_H) cells[y][x] = ch;
  };
  const plat = (x: number, y: number, len: number, ch = "#") => {
    for (let i = 0; i < len; i++) set(x + i, y, ch);
  };
  const ground = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) {
      set(x, 13, "#");
      set(x, 14, "=");
      set(x, 15, "=");
    }
  };
  const coins = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) set(x + i, y, "C");
  };
  paint({ w, set, ground, plat, coins });
  return cells.map((row) => row.join(""));
}

function level1(): LevelDef {
  const grid = build(110, ({ set, ground, plat, coins }) => {
    ground(0, 26);
    ground(31, 52);
    ground(58, 74);
    ground(80, 109);

    set(3, 12, "P");
    coins(7, 12, 4);
    set(14, 12, "E");
    coins(16, 9, 3);
    set(18, 10, "?");
    set(19, 10, "?");
    set(20, 10, "!");
    plat(22, 9, 3);
    set(23, 8, "H");
    set(25, 12, "K");
    set(40, 6, "*");

    plat(28, 11, 3, "^");
    coins(28, 10, 3);

    plat(34, 12, 3);
    plat(36, 11, 3);
    plat(38, 10, 4);
    set(39, 9, "B");
    set(40, 9, "?");
    coins(38, 8, 3);
    set(44, 12, "E");
    coins(48, 12, 3);

    plat(54, 9, 4, "^");
    coins(54, 8, 4);
    set(56, 6, "F");

    set(62, 12, "K");
    set(66, 12, "E");
    coins(68, 12, 3);
    plat(71, 7, 3);
    coins(71, 6, 3);

    plat(76, 11, 3, "^");
    coins(76, 10, 3);

    plat(92, 10, 4);
    coins(92, 9, 4);
    set(94, 12, "E");
    plat(102, 12, 1, "L");
    set(104, 8, "*");
    set(106, 12, "G");
  });
  return {
    id: 1,
    name: "银杏坡",
    nameEn: "Ginkgo Slope",
    dusk: false,
    time: 240,
    grid,
    movers: [],
  };
}

function level2(): LevelDef {
  const grid = build(124, ({ set, ground, plat, coins }) => {
    ground(0, 14);
    ground(20, 34);
    ground(48, 60);
    ground(78, 92);
    ground(108, 123);

    set(3, 12, "P");
    coins(6, 12, 3);
    set(10, 12, "E");
    set(12, 10, "?");
    set(13, 10, "?");

    plat(16, 12, 1, "L");
    plat(18, 10, 1, "L");
    coins(16, 9, 3);

    plat(24, 9, 4, "^");
    coins(24, 8, 4);
    set(26, 5, "F");
    set(30, 12, "N");

    plat(35, 13, 12, "S");
    plat(38, 10, 3, "^");
    plat(43, 8, 3, "^");
    coins(38, 9, 3);
    coins(43, 7, 3);

    plat(52, 10, 3);
    set(51, 12, "K");
    set(53, 9, "!");
    set(55, 12, "E");
    coins(57, 12, 3);

    plat(64, 7, 3);
    set(65, 6, "H");
    set(66, 4, "*");
    plat(68, 10, 4, "^");
    set(70, 8, "F");

    plat(84, 11, 3, "B");
    set(85, 10, "U");
    set(86, 12, "K");
    set(88, 12, "E");
    coins(90, 9, 4);
    plat(90, 10, 4);

    plat(96, 13, 10, "S");
    plat(98, 10, 2, "^");
    plat(102, 8, 3, "^");
    coins(102, 7, 3);

    plat(114, 10, 4);
    coins(114, 9, 3);
    set(116, 6, "*");
    set(118, 12, "G");
  });
  return {
    id: 2,
    name: "溪谷桥",
    nameEn: "Brook Bridge",
    dusk: false,
    time: 260,
    grid,
    movers: [
      { x: 36, y: 9, w: 3, range: 8, speed: 42, axis: "x" },
      { x: 66, y: 11, w: 3, range: 7, speed: 38, axis: "x" },
      { x: 99, y: 6, w: 2, range: 5, speed: 36, axis: "y" },
    ],
  };
}

function level3(): LevelDef {
  const grid = build(136, ({ set, ground, plat, coins }) => {
    ground(0, 12);
    ground(18, 28);
    ground(56, 66);
    ground(92, 102);
    ground(122, 135);

    set(3, 12, "P");
    coins(6, 12, 3);
    set(9, 10, "?");
    set(10, 10, "!");
    set(11, 12, "N");
    set(8, 8, "Y");
    set(21, 5, "*");

    plat(14, 10, 3, "^");
    coins(14, 9, 3);

    plat(22, 9, 4);
    set(23, 8, "B");
    set(24, 8, "?");
    set(26, 12, "E");
    set(22, 6, "F");

    plat(30, 13, 24, "S");
    plat(32, 10, 2, "^");
    plat(36, 8, 3, "^");
    plat(42, 7, 3);
    coins(36, 7, 3);
    coins(42, 6, 3);
    set(43, 5, "H");
    plat(48, 9, 3, "^");
    set(49, 4, "F");

    plat(58, 10, 4);
    set(57, 12, "K");
    set(58, 8, "Y");
    set(59, 9, "U");
    set(62, 12, "N");
    coins(64, 12, 3);

    plat(70, 8, 4, "^");
    coins(70, 7, 4);
    set(72, 5, "F");
    plat(76, 11, 3, "L");
    plat(80, 9, 3, "L");
    plat(84, 7, 3);
    coins(84, 6, 3);
    set(85, 4, "*");
    set(96, 8, "Y");

    plat(88, 13, 3, "S");
    set(94, 12, "E");
    set(96, 12, "K");
    set(98, 12, "N");
    plat(100, 10, 3);
    coins(100, 9, 3);

    plat(106, 13, 14, "S");
    plat(108, 9, 2, "^");
    plat(113, 7, 3, "^");
    coins(113, 6, 3);
    set(114, 3, "F");

    plat(126, 10, 5);
    coins(126, 9, 5);
    set(128, 6, "Y");
    set(130, 12, "G");
  });
  return {
    id: 3,
    name: "暮色林",
    nameEn: "Dusk Grove",
    dusk: true,
    time: 280,
    grid,
    movers: [
      { x: 32, y: 8, w: 3, range: 10, speed: 50, axis: "x" },
      { x: 74, y: 6, w: 2, range: 6, speed: 40, axis: "y" },
      { x: 107, y: 8, w: 3, range: 9, speed: 48, axis: "x" },
    ],
  };
}

export const LEVELS: LevelDef[] = [level1(), level2(), level3()];
