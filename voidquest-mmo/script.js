const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const minimapCanvas = document.getElementById("minimap");
const mm = minimapCanvas.getContext("2d");

// match CSS-størrelsen, men i “ekte” pixler:
const MINIMAP_SIZE = 160;
minimapCanvas.width = MINIMAP_SIZE;
minimapCanvas.height = MINIMAP_SIZE;

mm.imageSmoothingEnabled = false;
mm.webkitImageSmoothingEnabled = false;
mm.mozImageSmoothingEnabled = false;

// Viktig: unngå subpixel "blending" som lager streker mellom tiles
ctx.imageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;

// --- Menu / character screen refs ---
const screenMenu = document.getElementById("screen-menu");
const screenCharacter = document.getElementById("screen-character");

const btnPlay = document.getElementById("btn-play");
const btnBackMenu = document.getElementById("btn-back-menu");

const hasSaveBox = document.getElementById("char-has-save");
const createBox = document.getElementById("char-create");

const charNameEl = document.getElementById("char-name");
const charLastSavedEl = document.getElementById("char-last-saved");

const inputName = document.getElementById("input-name");
const btnFinishCharacter = document.getElementById("btn-finish-character");
const btnStartGame = document.getElementById("btn-start-game");


const hudZone = document.getElementById("hud-zone");
const hudPos = document.getElementById("hud-pos");
// --- Context menu refs ---
const gameWrap = document.getElementById("game-wrap");
const contextMenu = document.getElementById("context-menu");
// --- Chat log refs ---
const chatLogEl = document.getElementById("chatlog-messages");
//--- Save Knapp ----
const btnSave = document.getElementById("btn-save");

// --- Pause menu refs ---
const pauseMenuEl = document.getElementById("pause-menu");
const pauseItemsEl = document.getElementById("pause-items");

// --- Dialog UI refs ---
const dialogEl = document.getElementById("dialog");
const dialogNameEl = document.getElementById("dialog-name");
const dialogTextEl = document.getElementById("dialog-text");
const dialogOptionsEl = document.getElementById("dialog-options");
const dialogPortraitEl = document.querySelector(".dialog-portrait");

// --- Skills UI refs ---
const btnSkills = document.getElementById("btn-skills");
const skillsWindowEl = document.getElementById("skills-window");
const skillsListEl = document.getElementById("skills-list");
const btnSkillsClose = document.getElementById("btn-skills-close");
const skillsTitleEl = document.querySelector("#skills-window .skills-title");

// --- Inventory UI refs ---
const btnInventory = document.getElementById("btn-inventory");
const inventoryWindowEl = document.getElementById("inventory-window");
const inventoryGridEl = document.getElementById("inventory-grid");
const btnInventoryClose = document.getElementById("btn-inventory-close");

// --- Equipment UI refs ---
const btnEquip = document.getElementById("btn-equip");
const equipWindowEl = document.getElementById("equip-window");
const btnEquipClose = document.getElementById("btn-equip-close");

// --- Shop UI refs ---
const shopWindowEl = document.getElementById("shop-window");
const shopListEl = document.getElementById("shop-list");
const shopTitleEl = document.getElementById("shop-title");
const shopCoinsEl = document.getElementById("shop-coins");
const btnShopClose = document.getElementById("btn-shop-close");


// --- XP emblem refs ---
const xpPopEl = document.getElementById("xp-pop");


// --- Player hearts ---
const heartsEl = document.getElementById("hearts");

// viktig
const VIEW_TILES_X = 20;
const VIEW_TILES_Y = 12;

let animTime = 0;

canvas.width = VIEW_TILES_X * TILE_SIZE;
canvas.height = VIEW_TILES_Y * TILE_SIZE;


 //--- serviceWorker ---
 //if ("serviceWorker" in navigator) {
 //  window.addEventListener("load", () => {
 //    navigator.serviceWorker.register("./sw.js").catch(console.warn);
 //  });
 //}

// -------------------- CAMERA (follow player) --------------------
let cameraPx = 0;
let cameraPy = 0;

function clampCam(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updateCamera() {
  const worldW = level.width * TILE_SIZE;
  const worldH = level.height * TILE_SIZE;

  const viewW = canvas.width;
  const viewH = canvas.height;

  // mål: spilleren i midten
  const targetX = player.px + TILE_SIZE / 2 - viewW / 2;
  const targetY = player.py + TILE_SIZE / 2 - viewH / 2;

  // Viktig: denne støtter BOTH:
  // - store maps: clamp 0 .. (world - view)
  // - små maps: clamp (world - view) .. 0  (negativt)
  const minCamX = Math.min(0, worldW - viewW);
  const maxCamX = Math.max(0, worldW - viewW);

  const minCamY = Math.min(0, worldH - viewH);
  const maxCamY = Math.max(0, worldH - viewH);

  cameraPx = clampCam(targetX, minCamX, maxCamX);
  cameraPy = clampCam(targetY, minCamY, maxCamY);
}


function getVisibleTileBounds(camX, camY) {
  // Tegn litt utenfor skjermen for å unngå pop-in
  const startX = Math.floor(camX / TILE_SIZE) - 1;
  const startY = Math.floor(camY / TILE_SIZE) - 1;

  const endX = startX + VIEW_TILES_X + 2;
  const endY = startY + VIEW_TILES_Y + 2;

  return { startX, startY, endX, endY };
}


// Smooth movement settings
const BASE_MOVE_DURATION_MS = 200;   // hvor lang tid ett tile-steg tar (juster)
const STEP_REPEAT_DELAY_MS = 0; // 0 = start neste steg umiddelbart

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const tileImages = {};

const playerSkins = {};
const playerImages = {}; // dir -> { idle: Image, walk: Image[] }

const PLAYER_ANIMS = {
  down: {
    idle: "assets/player/pixelmannDown.png",
    walk: [
      "assets/player/pixelmannDownRun1.png",
      "assets/player/pixelmannDown.png",
      "assets/player/pixelmannDownRun2.png",
    ],
  },
  up: {
    idle: "assets/player/pixelmannUpIdle1.png",
    walk: [
      "assets/player/pixelmannUp.png",
      "assets/player/pixelmannUp1.png",
    ],
  },
  left: {
    idle: "assets/player/pixelmannLeft.png",
    walk: [
      "assets/player/pixelmannLeftRun1.png",
      "assets/player/pixelmannLeft.png",
    ],
  },
  right: {
    idle: "assets/player/pixelmannRight.png",
    walk: [
      "assets/player/pixelmannRightRun1.png",
      "assets/player/pixelmannRight.png",
    ],
  },
};


// hvor “fort” walk-frame bytter mens du går
const PLAYER_WALK_FRAME_MS = 90;

const npcImages = {}; // id -> Image

async function loadNpcAssets() {
  for (const lvl of Object.values(LEVELS)) {
    const npcs = lvl.npcs || [];
    for (const n of npcs) {
      const paths = [];

      // Støtt både gammel "sprite" og ny "sprites"
      if (Array.isArray(n.sprites) && n.sprites.length) {
        paths.push(...n.sprites);
      } else if (n.sprite) {
        paths.push(n.sprite);
      }

      for (const p of paths) {
        if (!p) continue;
        if (!npcImages[p]) {
          npcImages[p] = await loadImage(p);
        }
      }
    }
  }
}

async function loadAllAssets() {
  for (const [key, def] of Object.entries(TILE_DEFS)) {
    if (def.animated && Array.isArray(def.frames)) {
      // Flere PNG-filer
      tileImages[key] = [];
      for (const src of def.frames) {
        tileImages[key].push(await loadImage(src));
      }
    } else {
      // Vanlig tile (enkeltbilde) ELLER spritesheet (img)
      tileImages[key] = await loadImage(def.img);
    }
  }

  // Cache så vi ikke laster samme fil flere ganger
  const imgCache = {};

  async function loadCached(src) {
    if (!src) return null;
    if (!imgCache[src]) imgCache[src] = await loadImage(src);
    return imgCache[src];
  }

  async function loadPlayerAnimSet(skinId, animDef) {
    const out = {};
    for (const [dir, def] of Object.entries(animDef)) {
      const idleImg = await loadCached(def.idle);

      const walkFrames = [];
      for (const src of (def.walk || [])) {
        const img = await loadCached(src);
        if (img) walkFrames.push(img);
      }

      out[dir] = { idle: idleImg, walk: walkFrames };
    }
    playerSkins[skinId] = out;
  }

  // 1) Default skin
  await loadPlayerAnimSet("default", PLAYER_ANIMS);

  // 2) Armor skins (hvis item har playerAnims)
  for (const def of Object.values(ITEM_DEFS)) {
    if (def?.type === "armor" && def?.playerAnims) {
      await loadPlayerAnimSet(def.id, def.playerAnims);
    }
  }
  await loadNpcAssets();
  await loadFxAssets();
}

let currentLevelId = "spenningsbyen";
let level = LEVELS[currentLevelId];

const player = {
  // tile coords (logisk)
  x: level.spawn.x,
  y: level.spawn.y,

  // pixel coords (smooth rendering)
  px: level.spawn.x * TILE_SIZE,
  py: level.spawn.y * TILE_SIZE,

  level: 1,
  xp: 0,

  maxHp: 5,
  hp: 3,

  facing: "down",

  // movement state
  moving: false,
  fromPx: 0,
  fromPy: 0,
  toPx: 0,
  toPy: 0,
  moveElapsed: 0,

  moveDuration: BASE_MOVE_DURATION_MS,
};

// -------------------- SKILLS --------------------
let skills = {
  combat: { level: 1, xp: 0 },
};

// Skill-curve (litt annerledes enn main level)
// Level 2 = 50xp, Level 3 = 200xp, Level 4 = 450xp, ...
const MAX_SKILL_LEVEL = 100;

function totalSkillXpForLevel(L) {
  const level = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(L)));
  return (level - 1) * (level - 1) * 50;
}

function skillLevelFromXp(xp) {
  const x = Math.max(0, Math.floor(xp));
  const L = Math.floor(Math.sqrt(x / 50)) + 1;
  return Math.max(1, Math.min(MAX_SKILL_LEVEL, L));
}

let xpPopTimer = 0;

function showXpEmblem() {
  if (!xpPopEl) return;

  // sørg for at elementet ikke er hidden
  xpPopEl.classList.remove("hidden");
  xpPopEl.setAttribute("aria-hidden", "false");

  // restart animasjonen hver gang vi får XP
  xpPopEl.classList.remove("show");
  void xpPopEl.offsetWidth; // tving reflow så animasjonen faktisk restartes
  xpPopEl.classList.add("show");

  // skjul igjen etter animasjonen er ferdig (så den ikke ligger “klikkbar”)
  const totalMs = 1600; // må matche CSS animasjonstiden
  if (xpPopTimer) clearTimeout(xpPopTimer);
  xpPopTimer = setTimeout(() => {
    xpPopEl.classList.add("hidden");
    xpPopEl.setAttribute("aria-hidden", "true");
    xpPopEl.classList.remove("show");
    xpPopTimer = 0;
  }, totalMs);
}

function addSkillXp(skillId, amount) {
  const s = skills[skillId];
  if (!s) return;

  const gain = Math.max(0, Math.floor(amount || 0));
  if (gain <= 0) return;

  const beforeLevel = s.level;
  s.xp += gain;

  const afterLevel = skillLevelFromXp(s.xp);
  if (afterLevel > beforeLevel) {
    s.level = afterLevel;
    logMessage(`${skillId.toUpperCase()} level up! You are now ${s.level}.`, "loot");
  }

  // Emblem pop hver gang vi får XP (skill eller vanlig)
  showXpEmblem();

  // Hvis skills-vindu er åpent: refresh
  if (skillsWindowEl && !skillsWindowEl.classList.contains("hidden")) {
    renderSkillsWindow();
  }
}

let skillsOpen = false;

function renderSkillsWindow() {
  if (!skillsListEl) return;

  // Header: player level + STR
  if (skillsTitleEl) {
    const str = (typeof getPlayerStrength === "function") ? getPlayerStrength() : 1;

    skillsTitleEl.innerHTML = `
      Skills • Lvl ${player.level}
      <span class="skills-subline">STR: ${str}</span>
    `;
  }

  skillsListEl.innerHTML = "";

  // foreløpig bare combat
  const combat = skills.combat;

  const row = document.createElement("div");
  row.className = "skill-row";
  row.innerHTML = `
    <div class="skill-name">Combat</div>
    <div class="skill-meta">Lvl ${combat.level} • ${combat.xp} XP</div>
  `;
  skillsListEl.appendChild(row);
}

function openSkillsWindow() {
  skillsOpen = true;
  renderSkillsWindow();
  skillsWindowEl.classList.remove("hidden");
  skillsWindowEl.setAttribute("aria-hidden", "false");

  // Slipp input umiddelbart
  held.up = held.down = held.left = held.right = false;
  lastIntent = null;

  closeContextMenu?.();
}

function closeSkillsWindow() {
  skillsOpen = false;
  skillsWindowEl.classList.add("hidden");
  skillsWindowEl.setAttribute("aria-hidden", "true");

  held.up = held.down = held.left = held.right = false;
  lastIntent = null;
}


// -------------------- INVENTORY --------------------
const INV_COLS = 4;
const INV_ROWS = 5;
const INV_SIZE = INV_COLS * INV_ROWS;

// inventory = array med lengde 20, hvert element er enten null eller item-objekt
// item-objekt: { id: "potion", name: "Potion", icon: "assets/items/potion.png" }
let inventory = Array(INV_SIZE).fill(null);

const ITEM_DEFS = {
  coins: {
    id: "coins",
    name: "Coins",
    icon: "assets/items/coin.png",      // <- lag dette bildet i assets, eller bytt til noe du har
    type: "currency",
    description: "Shiny coins used for trading.",
    stackable: true,
  },
  scroll: {
    id: "scroll",
    name: "Old Scroll",
    icon: "assets/ui/inventoryScroll.png",
    type: "misc",
    description: "An ancient scroll filled with faded runes."
  },
  skelKnife: {
    id: "skelKnife",
    name: "Skeleton Knife",
    icon: "assets/items/skelKnife.png",
    fxSprite: "assets/items/skelKnife.png",
    type: "weapon",
    strength: 2,
    description: "A skeleton knife."
  },
  club: {
    id: "club",
    name: "Club",
    icon: "assets/items/club.png",
    fxSprite: "assets/items/club.png",
    type: "weapon",
    strength: 1,
    description: "An ordinary club, BONK!."
  },
  bronzeArmor: {
    id: "bronzeArmor",
    name: "Bronze Armor",
    icon: "assets/items/armor/bronzeArmorIcon.png",
    type: "armor",
    description: "A sturdy set of bronze armor.",
    // hvis armor også skal gi strength:
    // strength: 1,


    playerAnims: {
      down: {
        idle: "assets/player/bronzeArmor/bronzeArmorDown.png",
        walk: [
          "assets/player/bronzeArmor/bronzeArmorDownRun1.png",
          "assets/player/bronzeArmor/bronzeArmorDown.png",
          "assets/player/bronzeArmor/bronzeArmorDownRun2.png",
        ],
      },
      up: {
        idle: "assets/player/bronzeArmor/bronzeArmorUp.png",
        walk: [
          "assets/player/bronzeArmor/bronzeArmorUpRun1.png",
          "assets/player/bronzeArmor/bronzeArmorUpRun2.png",
        ],
      },
      left: {
        idle: "assets/player/bronzeArmor/bronzeArmorLeft.png",
        walk: [
          "assets/player/bronzeArmor/bronzeArmorLeftRun1.png",
          "assets/player/bronzeArmor/bronzeArmorLeft.png",
        ],
      },
      right: {
        idle: "assets/player/bronzeArmor/bronzeArmorRight.png",
        walk: [
          "assets/player/bronzeArmor/bronzeArmorRightRun1.png",
          "assets/player/bronzeArmor/bronzeArmorRight.png",
        ],
      },
    },
  },
  ring: {
    id: "ring",
    name: "Copper Ring",
    icon: "assets/ui/xp.png",
    type: "ring",
    description: "A small ring with a faint glow."
  },
  tool: {
    id: "tool",
    name: "Woodcutting Axe",
    icon: "assets/ui/xp.png",
    type: "tool",
    description: "A tool used for chopping trees."
  },

};

function normalizeInventory(arr) {
  const out = Array(INV_SIZE).fill(null);
  if (Array.isArray(arr)) {
    for (let i = 0; i < Math.min(arr.length, INV_SIZE); i++) {
      const it = arr[i];
      if (!it) continue;
      // godta både {id,name,icon} og bare {id}
      if (typeof it === "object" && typeof it.id === "string") {
        const def = ITEM_DEFS[it.id];
        const qty = Number.isFinite(it.qty) ? Math.max(1, Math.floor(it.qty)) : 1;
        out[i] = def ? { ...def, qty } : { ...it, qty };
      }
    }
  }
  return out;
}

function addItemToInventory(itemId, qty = 1) {
  const def = ITEM_DEFS[itemId];
  if (!def) return false;

  const amount = Math.max(1, Math.floor(qty || 1));

  // ✅ STACKABLE (coins)
  if (def.stackable) {
    // 1) prøv å finne eksisterende stack
    const existingIdx = inventory.findIndex(it => it && it.id === itemId && it.stackable);
    if (existingIdx !== -1) {
      inventory[existingIdx].qty = (inventory[existingIdx].qty || 1) + amount;
      renderInventoryWindow();
      saveGame?.();
      return true;
    }

    // 2) ellers: finn tom slot og lag ny stack
    const emptyIdx = inventory.findIndex(s => s === null);
    if (emptyIdx === -1) {
      logMessage("Inventory is full.", "error");
      return false;
    }

    inventory[emptyIdx] = { ...def, qty: amount };
    renderInventoryWindow();
    saveGame?.();
    return true;
  }

  // ✅ IKKE-STACKABLE: legg inn flere 1x
  let added = 0;
  for (let i = 0; i < amount; i++) {
    const idx = inventory.findIndex(s => s === null);
    if (idx === -1) {
      if (added === 0) logMessage("Inventory is full.", "error");
      break;
    }
    inventory[idx] = { ...def, qty: 1 };
    added++;
  }

  if (added > 0) {
    renderInventoryWindow();
    saveGame?.();
    return true;
  }
  return false;
}


// -------------------- LOOT / DROPS --------------------
// Drops format per enemy (map.js):
// npc.drops = [
//   { itemId: "potion", chance: 0.3 },              // 30%
//   { itemId: "scroll", chance: 10 },               // 10% (støttes også som prosent)
//   { itemId: "potion", chance: 0.2, qtyMin: 1, qtyMax: 3 },
// ]

function normalizeChance(chance) {
  // Støtter både 0..1 og 0..100
  if (typeof chance !== "number" || !Number.isFinite(chance)) return 0;
  if (chance <= 0) return 0;
  if (chance > 1) return Math.min(1, chance / 100);
  return Math.min(1, chance);
}

function randInt(min, max) {
  const a = Math.floor(min);
  const b = Math.floor(max);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function giveItemToInventoryOrLose(itemId, npcName = "Enemy") {
  const ok = addItemToInventory(itemId);
  if (!ok) {
    // Siden vi ikke har items på bakken: vi mister looten hvis inventory er full
    logMessage(`No inventory space — you lose ${itemId} from ${npcName}.`, "error");
  }
  return ok;
}

function rollNpcDrops(npc) {
  const drops = Array.isArray(npc?.drops) ? npc.drops : [];
  if (!drops.length) return [];

  const results = [];

  for (const d of drops) {
    if (!d || typeof d.itemId !== "string") continue;

    // finnes itemen i ITEM_DEFS?
    if (!ITEM_DEFS[d.itemId]) continue;

    const p = normalizeChance(d.chance);
    if (p <= 0) continue;

    if (Math.random() < p) {
      const qtyMin = (typeof d.qtyMin === "number" ? d.qtyMin : 1);
      const qtyMax = (typeof d.qtyMax === "number" ? d.qtyMax : qtyMin);
      const qty = randInt(qtyMin, qtyMax);

      for (let i = 0; i < Math.max(1, qty); i++) {
        results.push(d.itemId);
      }
    }
  }

  return results;
}

function handleNpcDeathLoot(npc) {
  const items = rollNpcDrops(npc);
  if (!items.length) return;

  // Gi items direkte til inventory
  // (Du kan velge om du vil stoppe på full inv eller fortsette. Her fortsetter vi.)
  for (const itemId of items) {
    giveItemToInventoryOrLose(itemId, npc?.name || "Enemy");
  }

  // logg i chat
  const counts = {};
  for (const id of items) {
    counts[id] = (counts[id] || 0) + 1;
  }

  const parts = [];
  for (const [id, qty] of Object.entries(counts)) {
    const name = ITEM_DEFS[id]?.name || id;
    parts.push(qty > 1 ? `${name} x${qty}` : name);
  }

  logMessage(`Loot: ${parts.join(", ")}`, "loot");
}


let inventoryOpen = false;

function renderInventoryWindow() {
  if (!inventoryGridEl) return;

  inventoryGridEl.innerHTML = "";

  for (let i = 0; i < INV_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "inv-slot";
    slot.dataset.slot = String(i);

    // Drop handlers (usynlig slot, men tar imot drop)
    slot.addEventListener("dragover", (e) => {
      e.preventDefault(); // må til for at drop skal funke
    });

    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData("text/inv-from"));
      const to = Number(slot.dataset.slot);

      if (!Number.isFinite(from) || !Number.isFinite(to)) return;
      if (from === to) return;

      // swap
      const tmp = inventory[to];
      inventory[to] = inventory[from];
      inventory[from] = tmp;

      renderInventoryWindow();
      saveGame?.();
    });

    const it = inventory[i];
    if (it) {
      const itemEl = document.createElement("div");
      itemEl.className = "inv-item";
      itemEl.draggable = true;
      itemEl.dataset.slot = String(i);

      const img = document.createElement("img");
      img.src = it.icon;
      img.alt = it.name;
      itemEl.appendChild(img);

      // Vis antall hvis stackable
      if (it.stackable && (it.qty || 1) > 1) {
        const q = document.createElement("div");
        q.className = "inv-qty";
        q.textContent = String(it.qty);
        itemEl.appendChild(q);
      }

      // drag start
      itemEl.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/inv-from", String(i));
        // litt bedre “feel”
        e.dataTransfer.effectAllowed = "move";
      });

      // høyreklikk item -> context menu -> Examine / Destroy
      itemEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const desc = it.description || "No information.";

        const entries = [];

        // Equip bare hvis riktig type
        if (EQUIP_SLOTS.includes(it.type)) {
          entries.push({
            label: "Equip",
            onClick: () => {
              equipFromInventory(i);
            }
          });
        }

        entries.push({
          label: "Examine",
          onClick: () => {
            const stats = formatItemStats(it);
            logMessage(`${it.name}: ${desc}${stats}`, "system");
          }
        });

        if (it.stackable && (it.qty || 1) > 1) {
          entries.push({
            label: "Destroy 1",
            onClick: () => {
              it.qty = (it.qty || 1) - 1;
              if (it.qty <= 0) inventory[i] = null;
              renderInventoryWindow();
              if (shopOpen) renderShopWindow();
              saveGame?.();
              logMessage(`Destroyed 1 ${it.name}.`, "system");
            }
          });

          entries.push({
            label: "Destroy all",
            onClick: () => {
              inventory[i] = null;
              renderInventoryWindow();
              if (shopOpen) renderShopWindow();
              saveGame?.();
              logMessage(`${it.name} destroyed.`, "system");
            }
          });
        } else {
          entries.push({
            label: "Destroy",
            onClick: () => {
              inventory[i] = null;
              renderInventoryWindow();
              saveGame?.();
              logMessage(`${it.name} destroyed.`, "system");
            }
          });
        }

        openContextMenu(e.clientX, e.clientY, it.name, entries);
      });

      slot.appendChild(itemEl);
    }

    inventoryGridEl.appendChild(slot);
  }
}

function openInventoryWindow() {
  if (!inventoryWindowEl) return;

  inventoryOpen = true;
  renderInventoryWindow();

  inventoryWindowEl.classList.remove("hidden");
  inventoryWindowEl.setAttribute("aria-hidden", "false");

  closeContextMenu?.();
}

function closeInventoryWindow() {
  if (!inventoryWindowEl) return;

  inventoryOpen = false;
  inventoryWindowEl.classList.add("hidden");
  inventoryWindowEl.setAttribute("aria-hidden", "true");

  closeContextMenu?.();
}

function toggleInventoryWindow() {
  if (!gameStarted) return;
  inventoryOpen ? closeInventoryWindow() : openInventoryWindow();
}

// -------------------- SHOP --------------------

let shopOpen = false;
let shopNpcRef = null; 

function getCoinStackIndex() {
  return inventory.findIndex(it => it && it.id === "coins" && it.stackable);
}

function getCoinCount() {
  const idx = getCoinStackIndex();
  if (idx === -1) return 0;
  return Math.max(0, Math.floor(inventory[idx].qty || 0));
}

function spendCoins(amount) {
  const cost = Math.max(0, Math.floor(amount || 0));
  if (cost <= 0) return true;

  const idx = getCoinStackIndex();
  if (idx === -1) return false;

  const have = Math.max(0, Math.floor(inventory[idx].qty || 0));
  if (have < cost) return false;

  const left = have - cost;
  if (left <= 0) inventory[idx] = null;
  else inventory[idx].qty = left;

  renderInventoryWindow();
  saveGame?.();
  return true;
}

function openShopForNpc(npc) {
  if (!npc || !npc.trader) return;

  shopOpen = true;
  shopNpcRef = npc;

  renderShopWindow();

  shopWindowEl.classList.remove("hidden");
  shopWindowEl.setAttribute("aria-hidden", "false");

  // slipp input
  held.up = held.down = held.left = held.right = false;
  lastIntent = null;

  closeContextMenu?.();
}

function closeShopWindow() {
  shopOpen = false;
  shopNpcRef = null;

  shopWindowEl.classList.add("hidden");
  shopWindowEl.setAttribute("aria-hidden", "true");
}

function renderShopWindow() {
  if (!shopListEl || !shopNpcRef) return;

  const npc = shopNpcRef;
  const coins = getCoinCount();

  if (shopTitleEl) shopTitleEl.textContent = `${npc.name}'s Shop`;
  if (shopCoinsEl) shopCoinsEl.textContent = `Coins: ${coins}`;

  shopListEl.innerHTML = "";

  const stock = Array.isArray(npc.shop) ? npc.shop : [];
  for (const s of stock) {
    const def = ITEM_DEFS[s.itemId];
    if (!def) continue;

    const price = Math.max(0, Math.floor(s.price || 0));

    const row = document.createElement("div");
    row.className = "shop-row";

    const img = document.createElement("img");
    img.src = def.icon;
    img.alt = def.name;

    const meta = document.createElement("div");
    meta.className = "shop-meta";
    const desc = def.description || "No information.";

    const statsRaw = formatItemStats(def).trim(); // "(STR: +1)" eller ""
    const statsText = statsRaw ? statsRaw.replace(/^\(|\)$/g, "") : ""; // "STR: +1"

    meta.innerHTML = `
      <div class="shop-name">${def.name}</div>
      <div class="shop-price">${price} coins</div>
      <div class="shop-desc">${desc}</div>
      ${statsText ? `<div class="shop-stats">${statsText}</div>` : ""}
    `;

    const buy = document.createElement("button");
    buy.className = "shop-buy";
    buy.type = "button";
    buy.textContent = "Buy";
    buy.disabled = (coins < price);

    buy.addEventListener("click", () => {
      const nowCoins = getCoinCount();
      if (nowCoins < price) {
        logMessage("Not enough coins.", "error");
        renderShopWindow();
        return;
      }

      // prøv å legge i inventory først
      const ok = addItemToInventory(def.id, 1);
      if (!ok) {
        logMessage("Inventory is full.", "error");
        return;
      }

      // trekk coins etter at item faktisk ble lagt inn
      const paid = spendCoins(price);
      if (!paid) {
        // edge-case: coins endret seg samtidig – rull tilbake item (enkelt)
        // (valgfritt, men fint)
        logMessage("Purchase failed.", "error");
        renderInventoryWindow();
        return;
      }

      logMessage(`You bought ${def.name} for ${price} coins.`, "loot");

      renderShopWindow();
      if (inventoryOpen) renderInventoryWindow();
    });

    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(buy);

    shopListEl.appendChild(row);
  }
}

btnShopClose?.addEventListener("click", () => {
  closeShopWindow();
});


// -------------------- STRENGTH --------------------
const BASE_STRENGTH = 1;

function getEquippedStrengthBonus() {
  let bonus = 0;
  for (const slot of EQUIP_SLOTS) {
    const it = equipped?.[slot];
    if (!it) continue;
    if (typeof it.strength === "number" && Number.isFinite(it.strength)) {
      bonus += it.strength;
    }
  }
  return bonus;
}

function getPlayerStrength() {
  return BASE_STRENGTH + getEquippedStrengthBonus();
}

function getPlayerHitRange() {
  const str = getPlayerStrength();
  const minHit = Math.max(1, Math.floor(str - 1));
  const maxHit = Math.max(minHit, Math.floor(str + 1));
  return { minHit, maxHit, str };
}

function randIntInclusive(min, max) {
  const a = Math.floor(min);
  const b = Math.floor(max);
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

function formatItemStats(it) {
  if (!it || typeof it !== "object") return "";

  const parts = [];

  if (typeof it.strength === "number" && Number.isFinite(it.strength) && it.strength !== 0) {
    const sign = it.strength > 0 ? "+" : "";
    parts.push(`STR: ${sign}${it.strength}`);
  }

  // (senere kan du legge til flere stats her, f.eks. DEF, ACC, osv.)
  return parts.length ? ` (${parts.join(", ")})` : "";
}


// -------------------- EQUIPMENT --------------------
const EQUIP_SLOTS = ["tool", "weapon", "armor", "ring"];

let equipped = {
  tool: null,
  weapon: null,
  armor: null,
  ring: null,
};

function normalizeEquipped(obj) {
  const out = { tool: null, weapon: null, armor: null, ring: null };
  if (!obj || typeof obj !== "object") return out;

  for (const k of EQUIP_SLOTS) {
    const it = obj[k];
    if (!it) continue;
    if (typeof it === "object" && typeof it.id === "string") {
      const def = ITEM_DEFS[it.id];
      out[k] = def ? { ...def } : { ...it };
    }
  }
  return out;
}

let equipOpen = false;

function renderEquipWindow() {
  if (!equipWindowEl) return;

  const slots = equipWindowEl.querySelectorAll(".equip-slot");
  slots.forEach(slotEl => {
    const key = slotEl.dataset.eq;
    slotEl.innerHTML = "";

    const it = equipped[key];
    if (!it) return;

    const wrap = document.createElement("div");
    wrap.className = "eq-item";

    const img = document.createElement("img");
    img.src = it.icon;
    img.alt = it.name;
    wrap.appendChild(img);

    // (valgfritt men nyttig) høyreklikk på equipped item -> examine + unequip
    wrap.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const desc = it.description || "No information.";
      openContextMenu(e.clientX, e.clientY, it.name, [
        {
          label: "Examine",
          onClick: () => {
            const stats = formatItemStats(it);
            logMessage(`${it.name}: ${desc}${stats}`, "system");
          },
        },
        {
          label: "Unequip",
          onClick: () => {
            // legg i første ledige inventory-slot
            const idx = inventory.findIndex(s => s === null);
            if (idx === -1) {
              logMessage("Inventory is full.", "error");
              return;
            }
            inventory[idx] = it;
            equipped[key] = null;

            renderInventoryWindow();
            renderEquipWindow();
            saveGame?.();
            if (skillsOpen) renderSkillsWindow();
          }
        }
      ]);
    });

    slotEl.appendChild(wrap);
  });
}

function openEquipWindow() {
  if (!equipWindowEl) return;
  equipOpen = true;

  renderEquipWindow();
  equipWindowEl.classList.remove("hidden");
  equipWindowEl.setAttribute("aria-hidden", "false");

  closeContextMenu?.();
}

function closeEquipWindow() {
  if (!equipWindowEl) return;
  equipOpen = false;

  equipWindowEl.classList.add("hidden");
  equipWindowEl.setAttribute("aria-hidden", "true");

  closeContextMenu?.();
}

function toggleEquipWindow() {
  if (!gameStarted) return;
  equipOpen ? closeEquipWindow() : openEquipWindow();
}

// Equip fra inventory index
function equipFromInventory(invIndex) {
  const it = inventory[invIndex];
  if (!it) return;

  const t = it.type;
  if (!EQUIP_SLOTS.includes(t)) return; // ikke equipable

  // swap: inventory-item <-> equipped slot
  const prev = equipped[t];
  equipped[t] = it;
  inventory[invIndex] = prev ? prev : null;

  renderInventoryWindow();
  if (equipOpen) renderEquipWindow();
  saveGame?.();
  if (skillsOpen) renderSkillsWindow();
}



// -------------------- COMBAT (tick) --------------------
const combat = {
  active: false,
  targetId: null,
  targetRef: null,       // peker på npc-objektet i level.npcs
  nextPlayerHitAt: 0,
  nextEnemyHitAt: 0,
};

const PLAYER_COMBAT = {
  attackSpeedMs: 3000,

};

// -------------------- XP / LEVEL --------------------
// Enkel curve: total XP for level L = (L-1)^2 * 100
// Level 1 = 0xp, Level 2 = 100xp, Level 3 = 400xp, Level 4 = 900xp, osv.
const MAX_LEVEL = 99;

function totalXpForLevel(level) {
  const L = Math.max(1, Math.min(MAX_LEVEL, level));
  return (L - 1) * (L - 1) * 100;
}

function levelFromXp(xp) {
  const x = Math.max(0, xp);
  const L = Math.floor(Math.sqrt(x / 100)) + 1;
  return Math.max(1, Math.min(MAX_LEVEL, L));
}

function xpToNextLevel() {
  const next = Math.min(MAX_LEVEL, player.level + 1);
  return Math.max(0, totalXpForLevel(next) - player.xp);
}

function addXp(amount) {
  const gain = Math.max(0, Math.floor(amount || 0));
  if (gain <= 0) return;

  const beforeLevel = player.level;
  player.xp += gain;

  const afterLevel = levelFromXp(player.xp);
  if (afterLevel > beforeLevel) {
    player.level = afterLevel;
    logMessage(`LEVEL UP! You are now level ${player.level}.`, "loot");
  }

  if (skillsOpen) renderSkillsWindow();
  logMessage(`You gain ${gain} XP. (${player.xp} XP, lvl ${player.level})`, "loot");
}


// --- Enemy regen når combat avsluttes (anti hit-and-run) ---
const ENEMY_DISENGAGE_REGEN_MS = 1200; // hvor fort den går tilbake til full

function startEnemyDisengageRegen(npc, nowMs) {
  if (!npc || npc.dead) return;
  if (typeof npc.maxHp !== "number") return;

  const hp = getNpcHp(npc);
  if (hp >= npc.maxHp) return; // full hp -> ingenting å regen

  npc._regenStartMs = nowMs;
  npc._regenFromHp = hp;
  npc._regenEndMs = nowMs + ENEMY_DISENGAGE_REGEN_MS;
  npc._regenToHp = npc.maxHp;
}

// Kjøres hver frame (i update-loop)
function updateEnemyRegens(nowMs) {
  for (const n of (level.npcs || [])) {
    if (!n || n.dead) continue;
    if (!Number.isFinite(n._regenEndMs)) continue;

    // hvis du angriper den igjen, stopp regen (combat skal styre hp da)
    if (combat.active && combat.targetRef === n) continue;

    const t = (nowMs - n._regenStartMs) / (n._regenEndMs - n._regenStartMs);

    if (t >= 1) {
      setNpcHp(n, n._regenToHp);
      n._regenStartMs = n._regenFromHp = n._regenEndMs = n._regenToHp = null;
    } else if (t >= 0) {
      const newHp = n._regenFromHp + (n._regenToHp - n._regenFromHp) * t;
      setNpcHp(n, Math.ceil(newHp));
    }
  }
}

// -------------------- ENEMY RESPAWN --------------------
const DEFAULT_ENEMY_RESPAWN_MS = 20000;

function getRespawnMs(npc) {
  // kan overrides per enemy i map.js med respawnMs
  return (typeof npc.respawnMs === "number" ? npc.respawnMs : DEFAULT_ENEMY_RESPAWN_MS);
}

function killNpcAndScheduleRespawn(npc, nowMs) {
  npc.dead = true;
  npc._respawnAt = nowMs + getRespawnMs(npc);

  // sett HP til 0 (og nullstill kortvarige visuals)
  setNpcHp(npc, 0);
  npc._hitFlashUntil = 0;
}

// -------------------- COMBAT VISUALS (synced with ticks) --------------------
const COMBAT_VFX = {
  swingMs: 180,     // hvor lenge "swing" vises
  hitFlashMs: 120,  // hvor lenge "blink" vises på den som tar dmg
};

// (valgfritt) hvis du vil bruke et slash-bilde du legger inn selv:
const SLASH_FX_SPRITE = "assets/fx/slash.png";
const fxImages = {}; // path -> Image

async function loadFxAssets() {
  // Samle alle fx paths vi vil prøve å laste
  const paths = new Set();

  // default
  paths.add(SLASH_FX_SPRITE);

  // enemy weapons fra map.js (LEVELS)
  for (const lvl of Object.values(LEVELS)) {
    for (const n of (lvl.npcs || [])) {
      if (n?.weaponFxSprite) paths.add(n.weaponFxSprite);
    }
  }

  // player weapon fx fra ITEM_DEFS
  for (const def of Object.values(ITEM_DEFS)) {
    if (def?.fxSprite) paths.add(def.fxSprite);
  }

  // last alt (men tåler at filer mangler)
  for (const p of paths) {
    try {
      fxImages[p] = await loadImage(p);
    } catch {
      // ok at noen ikke finnes mens du bygger assets
    }
  }
}


// liste med aktive fx (slagsveip)
let combatFx = []; 
// element: { startMs, endMs, ax, ay, tx, ty, spritePath }


function isNpcAlive(n) {
  return !!n && !n.dead;
}

function getNpcById(id) {
  return (level.npcs || []).find(n => n.id === id) || null;
}

function getNpcHp(n) {
  // vi lagrer runtime hp i n._hp
  if (typeof n._hp !== "number") n._hp = (typeof n.maxHp === "number" ? n.maxHp : 3);
  return n._hp;
}

function setNpcHp(n, v) {
  n._hp = Math.max(0, v);
}

// -------------------- ACCURACY / MISS --------------------
// Regler:
// - skill level 1..100
// - aldri under 50% hit chance
// - skalerer pent mot lvl 100 (ikke 100%)
// Du kan tweake tallene her uten å røre resten av koden.
const PLAYER_MIN_HIT_CHANCE = 0.50; // 50% ved lavt level
const PLAYER_MAX_HIT_CHANCE = 0.95; // 95% ved lvl 100
const PLAYER_ACCURACY_EXP = 0.70;   // curve: lavere = mer boost tidlig, høyere = senere boost

function rollHitWithChance(maxHit, hitChance) {
  const mh = Math.max(0, Math.floor(maxHit || 0));
  if (mh <= 0) return 0;

  // først: hit/miss
  if (Math.random() > clamp01(hitChance)) return 0;

  // så: damage 1..maxHit
  return 1 + Math.floor(Math.random() * mh);
}

function getPlayerHitChance() {
  const L = Math.max(1, Math.min(100, skills?.combat?.level || 1));
  const t = (L - 1) / 99; // 0..1
  const eased = Math.pow(t, PLAYER_ACCURACY_EXP);

  const chance = PLAYER_MIN_HIT_CHANCE + (PLAYER_MAX_HIT_CHANCE - PLAYER_MIN_HIT_CHANCE) * eased;
  return clamp01(chance);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// støtter både 0..1 og 0..100 (så du kan skrive 75 eller 0.75)
function normalizeHitChance(v, fallback = 0.65) {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  if (v > 1) return clamp01(v / 100);
  return clamp01(v);
}

function getNpcHitChance(npc) {
  // npc.hitChance kan settes i map.js
  return normalizeHitChance(npc?.hitChance, 0.65);
}

// Først: treffer/misser basert på chance. Hvis hit: rull damage 1..maxHit
function rollHitWithChance(maxHit, hitChance) {
  const mh = Math.max(0, Math.floor(maxHit || 0));
  if (mh <= 0) return 0;

  if (Math.random() > clamp01(hitChance)) return 0; // miss
  return 1 + Math.floor(Math.random() * mh);        // hit: 1..maxHit
}


function rollHit(maxHit) {
  // 0 = miss, ellers 1..maxHit
  const r = Math.floor(Math.random() * (maxHit + 1));
  return r; 
}

function stopCombat(reasonText = null, nowMs = performance.now()) {
  if (!combat.active) return;

  const npc = combat.targetRef || getNpcById(combat.targetId);

  if (reasonText) logMessage(reasonText, "system");

  // Hvis vi forlater combat og fienden lever -> regen raskt til full
  if (npc && npc.hostile && !npc.dead && typeof npc.maxHp === "number") {
    startEnemyDisengageRegen(npc, nowMs);
  }

  combat.active = false;
  combat.targetId = null;
  combat.targetRef = null;
  combat.nextPlayerHitAt = 0;
  combat.nextEnemyHitAt = 0;
}

function startCombat(npc) {
  if (!npc || !npc.hostile) return;
  if (!isNpcAlive(npc)) return;

  // Må stå ved siden av fienden (samme som NPC/dør-reglene du har)
  if (!isAdjacentToPlayer(npc.x, npc.y)) {
    logMessage("You need to stand next to the enemy.", "error");
    return;
  }

  combat.active = true;
  combat.targetId = npc.id;
  combat.targetRef = npc;

  const now = performance.now();
  combat.nextPlayerHitAt = now + 800;
  combat.nextEnemyHitAt = now + 1200;

  logMessage(`You attack ${npc.name}.`, "system");
}

function updateCombat(nowMs) {
  if (!combat.active) return;

  const npc = combat.targetRef || getNpcById(combat.targetId);
  if (!npc || !isNpcAlive(npc)) {
    stopCombat("Target lost.");
    return;
  }

  // Hvis du ikke står ved siden av fienden lenger: stopp combat
  if (!isAdjacentToPlayer(npc.x, npc.y)) {
    stopCombat("You stop fighting.", nowMs);
    return;
  }

  // ---- Player tick ----
  if (nowMs >= combat.nextPlayerHitAt) {
    // SWING FX (uansett hit/miss) – alltid synced med tick
    const pC = playerCenterPx();
    const nC = tileCenterPx(npc.x, npc.y);
    triggerSwing(pC.x, pC.y, nC.x, nC.y, nowMs, getPlayerWeaponFxSprite());

    // 1) Hit chance basert på combat skill
    const hitChance = getPlayerHitChance();

    // 2) Damage range basert på total strength (base + equipped bonuses)
    const { minHit, maxHit } = getPlayerHitRange();

    // 3) Rull hit/miss, og hvis hit: rull damage i minHit..maxHit
    let dmg = 0;
    if (Math.random() <= hitChance) {
      dmg = randIntInclusive(minHit, maxHit);
    } else {
      dmg = 0; // miss
    }

    if (dmg <= 0) {
      logMessage(`You miss ${npc.name}.`, "system");
    } else {
      // HIT FLASH på NPC akkurat når dmg skjer
      triggerNpcHitFlash(npc, nowMs);

      setNpcHp(npc, getNpcHp(npc) - dmg);
      logMessage(`You hit ${npc.name} for ${dmg}.`, "system");

      if (getNpcHp(npc) <= 0) {
        logMessage(`${npc.name} dies.`, "loot");

        handleNpcDeathLoot(npc);

        // XP reward
        const reward = (typeof npc.xpReward === "number" ? npc.xpReward : 0);
        addXp(reward);

        killNpcAndScheduleRespawn(npc, nowMs);
        stopCombat(null, nowMs);
        return;
      }
    }

    combat.nextPlayerHitAt = nowMs + PLAYER_COMBAT.attackSpeedMs;
  }


  // Enemy stats (fallback hvis de mangler i map.js)
  const enemySpeed = typeof npc.attackSpeedMs === "number" ? npc.attackSpeedMs : 1400;
  const enemyMaxHit = typeof npc.maxHit === "number" ? npc.maxHit : 1;

  if (nowMs >= combat.nextEnemyHitAt) {
    // SWING FX fra NPC -> player (uansett hit/miss)
    const nC = tileCenterPx(npc.x, npc.y);
    const pC = playerCenterPx();
    triggerSwing(nC.x, nC.y, pC.x, pC.y, nowMs, getEnemyWeaponFxSprite(npc));

    const enemyHitChance = getNpcHitChance(npc);
    const dmg = rollHitWithChance(enemyMaxHit, enemyHitChance);

    if (dmg <= 0) {
      logMessage(`${npc.name} misses you.`, "system");
    } else {
      triggerPlayerHitFlash(nowMs);

      logMessage(`${npc.name} hits you for ${dmg}.`, "error");
      damagePlayer(dmg);

      // 50% chance: combat skill XP når du tar damage
      if (Math.random() < 0.5) {
        const gain = (typeof npc.combatXpOnHit === "number" ? npc.combatXpOnHit : dmg);
        addSkillXp("combat", gain);
      }
    }

    combat.nextEnemyHitAt = nowMs + enemySpeed;
  }

}

function updateRespawns(nowMs) {
  for (const n of (level.npcs || [])) {
    if (!n.dead) continue;
    if (!Number.isFinite(n._respawnAt)) continue;

    if (nowMs >= n._respawnAt) {
      n.dead = false;
      n._respawnAt = null;

      // full heal på respawn
      if (typeof n.maxHp === "number") {
        setNpcHp(n, n.maxHp);
      } else {
        setNpcHp(n, 3);
      }

      // valgfritt: liten log
      logMessage(`${n.name} respawns.`, "system");
    }
  }
}


// -------------------- NPC + DIALOG DATA --------------------

// Dialog “scripts” (node-basert)
const DIALOGS = {
  guide_intro: {
    start: "start",
    nodes: {
      start: {
        speaker: "Oleander",
        text: "Good day to you, traveller.",
        options: [
          { label: "How do i play?", next: "howto" },
          { label: "Could you help me out? Im hurt.", next: "heal" },
          { label: "Goodbye.", end: true },
        ]
      },
      howto: {
        speaker: "Oleander",
        text: "WASD/piltaster for å gå. Høyreklikk for actions. Snakk med NPCer for quests.",
        options: [
          { label: "Back", next: "start" },
          { label: "Goodbye.", end: true },
        ]
      },
      heal: {
        speaker: "Oleander",
        text: "To help a fellow Path Seeker have always been my duty.",
        options: [
          { label: "I appreciate it!", action: "heal", next: "after_heal" },
          { label: "Back", next: "start" },
        ]
      },
      after_heal: {
        speaker: "Oleander",
        text: "You will always think of me in a place of need, my friend.",
        options: [
          { label: "Thanks!", end: true },
          { label: "Back", next: "start" },
        ]
      }
    }
  },
  trader_01: {
    start: "start",
    nodes: {
      start: {
        speaker: "Trader",
        text: "OY! You got some spare coins in exchange of valuable goods?",
        options: [
          { label: "Where have you got these items?", next: "whereItems" },
          { label: "I have to go", end: true },
        ]
      },
      whereItems: {
        speaker: "Trader",
        text: "You never ask a trader where the goods came from! I myself have endured great hardship in exchange of these items.",
        options: [
          { label: "Back", next: "start" },
          { label: "Im sorry, i have to go", end: true },
        ]
      },
    }
  },
};

// Runtime state for dialog
let dialogState = {
  open: false,
  npcId: null,
  dialogId: null,
  nodeId: null,
  optionIndex: 0,
};


//HELPERS

function getPortalAt(x, y) {
  const portals = level.portals || [];
  return portals.find(p => p.x === x && p.y === y) || null;
}

function getNpcsInLevel() {
  return (level.npcs || []).filter(isNpcAlive);
}

function getNpcAt(x, y) {
  return getNpcsInLevel().find(n => n.x === x && n.y === y) || null;
}

function isNpcBlocking(x, y) {
  return !!getNpcAt(x, y);
}

function openContextForFacedTileCentered() {
  const { x, y } = getFacedTileCoords();

  // Senter av canvas som posisjon for meny (kontroller)
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const npc = getNpcAt(x, y);
  if (npc) {
    openContextMenu(cx, cy, npc.name, [
      { label: `Talk-to ${npc.name}`, onClick: () => openDialogForNpc(npc) },
      { label: "Examine", onClick: () => logMessage(`${npc.name} ser opptatt ut.`, "system") },
    ]);
    return;
  }

  logMessage("Ingenting å interagere med der.", "system");
}

function getNpcSpritePathForTime(n, nowMs) {
  // Hvis NPC har 2+ sprites: idle animasjon
  if (Array.isArray(n.sprites) && n.sprites.length > 0) {
    const speed = typeof n.idleMs === "number" ? n.idleMs : 400; // default 400ms
    const idx = Math.floor(nowMs / speed) % n.sprites.length;
    return n.sprites[idx];
  }

  // fallback: gammel "sprite"
  return n.sprite || null;
}

function setChatVisible(isVisible) {
  const chat = document.getElementById("chatlog");
  if (!chat) return;
  chat.classList.toggle("hidden", !isVisible);
}

function tileCenterPx(tx, ty) {
  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    y: ty * TILE_SIZE + TILE_SIZE / 2,
  };
}

function playerCenterPx() {
  return {
    x: player.px + TILE_SIZE / 2,
    y: player.py + TILE_SIZE / 2,
  };
}

function getPlayerWeaponFxSprite() {
  // Hvis du har equiped weapon og det har fxSprite, bruk den
  const w = equipped?.weapon;
  if (w?.fxSprite) return w.fxSprite;

  // (valgfritt) hvis du vil bruke icon som fallback:
  // if (w?.icon) return w.icon;

  // ellers: default slash
  return SLASH_FX_SPRITE;
}

function getEnemyWeaponFxSprite(npc) {
  // Hvis enemy har definert egen weaponFxSprite i map.js
  if (npc?.weaponFxSprite) return npc.weaponFxSprite;

  // ellers: default slash
  return SLASH_FX_SPRITE;
}


// Registrer et "swing" fra attacker -> target
function triggerSwing(attackerCx, attackerCy, targetCx, targetCy, nowMs, spritePath) {
  combatFx.push({
    startMs: nowMs,
    endMs: nowMs + COMBAT_VFX.swingMs,
    ax: attackerCx,
    ay: attackerCy,
    tx: targetCx,
    ty: targetCy,

    // ✅ NY: hvilket bilde akkurat denne swingen skal bruke
    spritePath: spritePath || SLASH_FX_SPRITE,
  });
}

// Blink på NPC når den tar damage
function triggerNpcHitFlash(npc, nowMs) {
  npc._hitFlashUntil = nowMs + COMBAT_VFX.hitFlashMs;
}

// Blink på player når player tar damage
function triggerPlayerHitFlash(nowMs) {
  player._hitFlashUntil = nowMs + COMBAT_VFX.hitFlashMs;
}


// -------------------- PROFILE + SAVE KEYS --------------------
const PROFILE_KEY = "voidquest_profile_v1";

function getSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasSave() {
  const s = getSave();
  if (!s || typeof s !== "object") return false;
  if (!s.player) return false;

  // Ikke krev profile.name for at save skal “eksistere”
  return true;
}

function setProfileName(name) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name }));
}

function getProfileName() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.name || null;
  } catch {
    return null;
  }
}

function getCharacterNameFromSaveOrProfile() {
  const s = getSave();
  const fromSave = s?.profile?.name || null;
  return fromSave || getProfileName();
}

function showMenu() {
  screenMenu.classList.remove("hidden");
  screenCharacter.classList.add("hidden");
  screenCharacter.setAttribute("aria-hidden", "true");

  // skjul game UI mens du er i meny
  document.getElementById("hotbar").classList.add("hidden");
  document.getElementById("chatlog").classList.add("hidden");
}

function showCharacterScreen() {
  screenMenu.classList.add("hidden");
  screenCharacter.classList.remove("hidden");
  screenCharacter.setAttribute("aria-hidden", "false");

  const s = getSave();

  if (hasSave()) {
    // vis eksisterende character
    hasSaveBox.classList.remove("hidden");
    hasSaveBox.setAttribute("aria-hidden", "false");

    createBox.classList.add("hidden");
    createBox.setAttribute("aria-hidden", "true");

    charNameEl.textContent = getCharacterNameFromSaveOrProfile() || "Unknown";
    charLastSavedEl.textContent = s?.ts ? new Date(s.ts).toLocaleString() : "-";
  } else {
    // create character
    hasSaveBox.classList.add("hidden");
    hasSaveBox.setAttribute("aria-hidden", "true");

    createBox.classList.remove("hidden");
    createBox.setAttribute("aria-hidden", "false");

    inputName.value = "";
    held.up = held.down = held.left = held.right = false;
    lastIntent = null;
    inputName.focus();
  }
}

function hideAllScreensAndShowGameUI() {
  screenMenu.classList.add("hidden");
  screenCharacter.classList.add("hidden");
  screenCharacter.setAttribute("aria-hidden", "true");

  document.getElementById("hotbar").classList.remove("hidden");
  document.getElementById("chatlog").classList.remove("hidden");
}



// -------------------- SAVE / LOAD (LocalStorage) --------------------
const SAVE_KEY = "voidquest_save_v1";

function buildSaveData() {
  return {
    v: 1,
    ts: Date.now(),

    profile: {
      name: getProfileName(),
    },

    // hvor du er
    levelId: currentLevelId,
    player: {
      x: player.x,
      y: player.y,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      maxHp: player.maxHp,
      facing: player.facing,
    },
    skills: skills,
    inventory: inventory,
    equipped: equipped,

  };
}

function applySaveData(data) {
  if (!data || typeof data !== "object") return false;

  // ✅ Hvis levelId er ukjent (du har endret map.js), fallback i stedet for å “miste” save
  let levelId = data.levelId;
  if (!levelId || !LEVELS[levelId]) {
    const fallback = Object.keys(LEVELS)[0]; // eller "spenningsbyen" hvis du vil hardkode
    console.warn("[SAVE] Unknown levelId in save:", levelId, "-> fallback:", fallback);
    levelId = fallback;
  }
  // 0) Player core stats
  if (Number.isFinite(data.player?.maxHp)) player.maxHp = clamp(data.player.maxHp, 1, 99);
  if (Number.isFinite(data.player?.hp)) player.hp = clamp(data.player.hp, 0, player.maxHp);

  // 1) LOAD XP først
  if (Number.isFinite(data.player?.xp)) player.xp = Math.max(0, Math.floor(data.player.xp));
  else player.xp = 0;

  // 2) Level er avledet av XP
  player.level = levelFromXp(player.xp);

  renderHearts();

  // 3) Flytt til riktig level + pos
  const px = Number(data.player?.x);
  const py = Number(data.player?.y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return false;

  setLevel(levelId, null, { x: px, y: py });

  // 4) facing
  if (typeof data.player?.facing === "string") {
    player.facing = data.player.facing;
  }

  // 5) skills
  if (data.skills && typeof data.skills === "object") {
    const c = data.skills.combat;
    if (c && typeof c === "object") {
      skills.combat = {
        xp: Math.max(0, Math.floor(c.xp || 0)),
        level: 1,
      };
      skills.combat.level = skillLevelFromXp(skills.combat.xp);
    }
  }

  // 6) inventory
  inventory = normalizeInventory(data.inventory);
  if (inventoryOpen) renderInventoryWindow();

  // 7) equipped
  equipped = normalizeEquipped(data.equipped);
  if (equipOpen) renderEquipWindow();

  return true;
}

function canWriteSave() {
  const name = getProfileName();
  return typeof name === "string" && name.trim().length >= 2 && gameStarted;
}

function saveGame() {
  // IKKE lag save før character er ferdig (navn + game startet)
  if (!canWriteSave()) return false;

  try {
    const data = buildSaveData();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    console.log("[SAVE] Game saved.", new Date().toLocaleTimeString());
    return true;
  } catch (err) {
    console.error("Save failed:", err);
    logMessage("Save failed (see console).", "error");
    return false;
  }
}


function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    const ok = applySaveData(data);

    if (!ok) {
      logMessage("Save file invalid. Starting fresh.", "error");
      return false;
    }

    logMessage("Save loaded.", "system");
    return true;
  } catch (err) {
    console.error("Load failed:", err);
    logMessage("Load failed (see console).", "error");
    return false;
  }
}


function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function setLevel(newLevelId, entryFromDirection = null, forcedSpawn = null) {
  currentLevelId = newLevelId;
  level = LEVELS[currentLevelId];

  // Velg tile-pos
  if (forcedSpawn) {
    player.x = forcedSpawn.x;
    player.y = forcedSpawn.y;
  } else if (entryFromDirection === "west") {
    player.x = 1;
    player.y = clamp(player.y, 1, level.height - 2);
  } else if (entryFromDirection === "east") {
    player.x = level.width - 2;
    player.y = clamp(player.y, 1, level.height - 2);
  } else if (entryFromDirection === "north") {
    player.y = 1;
    player.x = clamp(player.x, 1, level.width - 2);
  } else if (entryFromDirection === "south") {
    player.y = level.height - 2;
    player.x = clamp(player.x, 1, level.width - 2);
  } else {
    player.x = level.spawn.x;
    player.y = level.spawn.y;
  }

  // Snap pixel-pos til tile-pos
  player.px = player.x * TILE_SIZE;
  player.py = player.y * TILE_SIZE;

  // stopp eventuell bevegelse
  player.moving = false;
  player.moveElapsed = 0;

  updateHud();
}


function tileAtLayer(grid, x, y) {
  if (!grid) return null;

  // Bruk level.width/height som “logisk verden”
  if (y < 0 || y >= level.height || x < 0 || x >= level.width) return null;

  // SAFE: grid kan mangle rader/kolonner når du har endret størrelse
  const row = grid[y];
  if (!row) return null;

  const v = row[x];
  return (v === undefined ? null : v);
}

function isWalkable(x, y) {
  // NPCer blokkerer ruten
  if (isNpcBlocking(x, y)) return false;

  const mid = tileAtLayer(level.grid_mid, x, y);
  if (mid && mid !== EMPTY) {
    const def = TILE_DEFS[mid];
    return !!def?.walkable;
  }

  const base = tileAtLayer(level.grid_base, x, y);
  if (!base || base === EMPTY) return false;
  const def = TILE_DEFS[base];
  return !!def?.walkable;
}

function getTopmostTileKeyAt(x, y) {
  // Prioritet: mid først (for trees), ellers base.
  const mid = tileAtLayer(level.grid_mid, x, y);
  if (mid && mid !== EMPTY) return { layer: "mid", key: mid };

  const base = tileAtLayer(level.grid_base, x, y);
  if (base && base !== EMPTY) return { layer: "base", key: base };

  return null;
}

function getFacedTileCoords() {
  let dx = 0, dy = 0;

  if (player.facing === "up") dy = -1;
  else if (player.facing === "down") dy = 1;
  else if (player.facing === "left") dx = -1;
  else if (player.facing === "right") dx = 1;

  return { x: player.x + dx, y: player.y + dy };
}

function describeFacedBlockedTile() {
  // ikke i menyer/pause
  if (!gameStarted) return;
  if (isUiBlocked()) return;

  const { x, y } = getFacedTileCoords();

  const top = getTopmostTileKeyAt(x, y);
  if (!top) {
    logMessage("Nothing interesting there.", "system");
    return;
  }

  const def = TILE_DEFS[top.key];
  const walkable = !!def?.walkable;

  // Kun “blocked” tiles som du ikke kan gå gjennom
  if (walkable) return;

  const text = def?.description || "Something is there.";
  logMessage(text, "system");
}


function isAdjacentToPlayer(tx, ty) {
  const dx = Math.abs(player.x - tx);
  const dy = Math.abs(player.y - ty);
  // “ved siden av” i 4-retning
  return (dx + dy) === 1;
}

function closeContextMenu() {
  contextMenu.classList.add("hidden");
  contextMenu.setAttribute("aria-hidden", "true");
  contextMenu.innerHTML = "";
}

function openContextMenu(px, py, title, entries) {
  // entries: [{label, onClick}]
  contextMenu.innerHTML = "";

  const titleEl = document.createElement("div");
  titleEl.className = "cm-title";
  titleEl.textContent = title;
  contextMenu.appendChild(titleEl);

  for (const entry of entries) {
    const btn = document.createElement("button");
    btn.className = "cm-item";
    btn.type = "button";
    btn.textContent = entry.label;
    btn.addEventListener("click", () => {
      closeContextMenu();
      entry.onClick();
    });
    contextMenu.appendChild(btn);
  }

  // posisjon inne i game-wrap
  const wrapRect = gameWrap.getBoundingClientRect();
  const menuRectWidth = 180; // approx for clamp
  const menuRectHeight = 120;

  let left = px - wrapRect.left;
  let top = py - wrapRect.top;

  // clamp så menyen ikke går utenfor game-wrap
  left = Math.max(8, Math.min(left, wrapRect.width - menuRectWidth - 8));
  top = Math.max(8, Math.min(top, wrapRect.height - menuRectHeight - 8));

  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;

  contextMenu.classList.remove("hidden");
  contextMenu.setAttribute("aria-hidden", "false");
}



// ----------- Rendering -----------
function drawLayer(grid, imageDict, camX, camY) {
  const { startX, startY, endX, endY } = getVisibleTileBounds(camX, camY);

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const key = tileAtLayer(grid, x, y);
      if (!key || key === EMPTY) continue;

      const def = TILE_DEFS[key];
      const imgOrFrames = imageDict[key];

      // 1) Separate PNG frames (Image[])
      if (def?.animated && Array.isArray(def.frames) && Array.isArray(imgOrFrames)) {
        const frameCount = imgOrFrames.length;
        const dur = def.frameDuration ?? 200;
        const frameIndex = Math.floor(animTime / dur) % frameCount;

        const frameImg = imgOrFrames[frameIndex];
        ctx.drawImage(frameImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        continue;
      }

      // 2) Spritesheet animasjon (ett bilde med frames på x-aksen)
      if (def?.animated && typeof def.frames === "number" && imgOrFrames instanceof Image) {
        const frameCount = def.frames;
        const dur = def.frameDuration ?? 200;
        const frameIndex = Math.floor(animTime / dur) % frameCount;

        ctx.drawImage(
          imgOrFrames,
          frameIndex * TILE_SIZE, 0,
          TILE_SIZE, TILE_SIZE,
          x * TILE_SIZE, y * TILE_SIZE,
          TILE_SIZE, TILE_SIZE
        );
        continue;
      }

      // 3) Vanlig tile
      if (imgOrFrames instanceof Image) {
        ctx.drawImage(imgOrFrames, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

function drawMinimap() {
  if (!minimapCanvas) return;

  // Hvor mange tiles rundt spilleren minimap viser:
  // 6 => diameter 13 tiles (6 venstre + spiller + 6 høyre)
  const R = 16;
  const tilesAcross = R * 2 + 1;

  // Skala: minimap-pixler per world-pixel
  const scale = MINIMAP_SIZE / (tilesAcross * TILE_SIZE);

  const centerX = MINIMAP_SIZE / 2;
  const centerY = MINIMAP_SIZE / 2;
  const radiusPx = MINIMAP_SIZE / 2;

  // spilleren sin “world-pixel” pos (bruk px for smooth)
  const worldCenterX = player.px + TILE_SIZE / 2;
  const worldCenterY = player.py + TILE_SIZE / 2;

  // Topp-venstre world-pixel for minimap-utsnittet
  const viewWorldW = tilesAcross * TILE_SIZE;
  const viewWorldH = tilesAcross * TILE_SIZE;
  const viewWorldX = worldCenterX - viewWorldW / 2;
  const viewWorldY = worldCenterY - viewWorldH / 2;

  // ---- clear + sirkulær clip ----
  mm.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  mm.save();
  mm.beginPath();
  mm.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
  mm.clip();

  // Bakgrunn inni sirkelen
  mm.fillStyle = "rgba(0,0,0,0.25)";
  mm.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // ---- tegn tiles (base + mid + top) i et lite område ----
  const startTileX = Math.floor(viewWorldX / TILE_SIZE);
  const startTileY = Math.floor(viewWorldY / TILE_SIZE);
  const endTileX = startTileX + tilesAcross - 1;
  const endTileY = startTileY + tilesAcross - 1;

  // Helper: tegn en tile fra en grid
  function drawMiniLayer(grid) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const key = tileAtLayer(grid, tx, ty);
        if (!key || key === EMPTY) continue;

        const imgOrFrames = tileImages[key];
        if (!imgOrFrames) continue;

        // world-pixel -> minimap-pixel
        const wx = tx * TILE_SIZE;
        const wy = ty * TILE_SIZE;
        const mx = (wx - viewWorldX) * scale;
        const my = (wy - viewWorldY) * scale;
        const mSize = TILE_SIZE * scale;

        // Hvis animert tile (frames array), velg frame
        const def = TILE_DEFS[key];
        if (def?.animated && Array.isArray(def.frames) && Array.isArray(imgOrFrames)) {
          const frameCount = imgOrFrames.length;
          const dur = def.frameDuration ?? 200;
          const frameIndex = Math.floor(animTime / dur) % frameCount;
          const frameImg = imgOrFrames[frameIndex];
          mm.drawImage(frameImg, mx, my, mSize, mSize);
          continue;
        }

        // Hvis spritesheet animasjon (ett bilde med frames)
        if (def?.animated && typeof def.frames === "number" && imgOrFrames instanceof Image) {
          const frameCount = def.frames;
          const dur = def.frameDuration ?? 200;
          const frameIndex = Math.floor(animTime / dur) % frameCount;

          mm.drawImage(
            imgOrFrames,
            frameIndex * TILE_SIZE, 0,
            TILE_SIZE, TILE_SIZE,
            mx, my,
            mSize, mSize
          );
          continue;
        }

        // Vanlig tile
        if (imgOrFrames instanceof Image) {
          mm.drawImage(imgOrFrames, mx, my, mSize, mSize);
        }
      }
    }
  }

  drawMiniLayer(level.grid_base);
  drawMiniLayer(level.grid_mid);
  drawMiniLayer(level.grid_top);

  // ---- spiller-markør i sentrum ----
  mm.save();
  mm.fillStyle = "#ffffff";
  mm.beginPath();
  mm.arc(centerX, centerY, Math.max(2, 4 * (MINIMAP_SIZE / 160)), 0, Math.PI * 2);
  mm.fill();
  mm.restore();

  mm.restore(); // clip

  // ---- enkel border-ring (midlertidig, til du legger rammebilde) ----
  mm.save();
  mm.strokeStyle = "rgba(255,255,255,0.35)";
  mm.lineWidth = 3;
  mm.beginPath();
  mm.arc(centerX, centerY, radiusPx - 1.5, 0, Math.PI * 2);
  mm.stroke();
  mm.restore();
}

function getActiveSkinId() {
  const armor = equipped?.armor;
  if (armor && playerSkins[armor.id]) return armor.id;
  return "default";
}

function getPlayerSprite() {
  const skinId = getActiveSkinId();
  const skin = playerSkins[skinId];
  if (!skin) return null;

  const pack = skin[player.facing];
  if (!pack) return null;

  // Hvis ikke moving: idle
  if (!player.moving) return pack.idle;

  // Hvis moving og vi har walk-frames: velg frame
  if (pack.walk && pack.walk.length > 0) {
    const t = player.moveElapsed; // ms inn i steget
    const idx = Math.floor(t / PLAYER_WALK_FRAME_MS) % pack.walk.length;
    return pack.walk[idx];
  }

  return pack.idle;
}



function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // oppdater kamera før vi tegner
  updateCamera();

  // Snap kamera til hele piksler for å unngå seams
  const camX = Math.round(cameraPx);
  const camY = Math.round(cameraPy);

  ctx.save();
  ctx.translate(-camX, -camY);

  // base -> mid
  drawLayer(level.grid_base, tileImages, camX, camY);
  drawLayer(level.grid_mid, tileImages, camX, camY);

  //NPC
  const nowMs = performance.now();

  drawMinimap();

  for (const n of getNpcsInLevel()) {
    const path = getNpcSpritePathForTime(n, nowMs);
    const img = path ? npcImages[path] : null;

    const nx = n.x * TILE_SIZE;
    const ny = n.y * TILE_SIZE;

    // --- draw npc sprite ---
    if (img) {
      ctx.drawImage(img, nx, ny, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(nx, ny, TILE_SIZE, TILE_SIZE);
    }

    // --- HIT FLASH (NPC) ---
    if (n._hitFlashUntil && nowMs < n._hitFlashUntil) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(nx, ny, TILE_SIZE, TILE_SIZE);
      ctx.restore();
    }

    // --- ENEMY HEALTH BAR (vises kun hvis mistet HP) ---
    // Vi viser kun for fiender (hostile) og kun når de har maxHp satt
    if (n.hostile && typeof n.maxHp === "number") {
      const hp = getNpcHp(n);
      const max = n.maxHp;

      if (hp < max) {
        const barW = TILE_SIZE - 8;
        const barH = 5;

        // litt over hodet
        const bx = nx + 4;
        const by = ny - 8;

        const pct = Math.max(0, Math.min(1, hp / max));
        const fillW = Math.floor(barW * pct);

        // bakgrunn
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#000000";
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

        // tom bar (mørk)
        ctx.fillStyle = "#400000";
        ctx.fillRect(bx, by, barW, barH);

        // fylt del
        ctx.fillStyle = "#00c853";
        ctx.fillRect(bx, by, fillW, barH);

        ctx.restore();
      }
    }
  }


  // player
  const pImg = getPlayerSprite();
  if (pImg) {
    ctx.drawImage(pImg, player.px, player.py, TILE_SIZE, TILE_SIZE);
  } else {
    ctx.fillStyle = "#4cc9f0";
    ctx.fillRect(player.px, player.py, TILE_SIZE, TILE_SIZE);
  }

  // HIT FLASH (player)
  if (player._hitFlashUntil && nowMs < player._hitFlashUntil) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(player.px, player.py, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  // --- COMBAT FX (slash) ---
  if (combatFx.length) {
    // fjern utløpte
    combatFx = combatFx.filter(fx => nowMs < fx.endMs);

    for (const fx of combatFx) {
      const t = (nowMs - fx.startMs) / (fx.endMs - fx.startMs); // 0..1
      if (t < 0 || t > 1) continue;

      const dx = fx.tx - fx.ax;
      const dy = fx.ty - fx.ay;

      // midtpunkt som "swing" beveger seg rundt
      const mx = fx.ax + dx * 0.55;
      const my = fx.ay + dy * 0.55;

      // hvis du har slash.png: tegn den
      const spriteKey = fx.spritePath || SLASH_FX_SPRITE;
      const slashImg = fxImages[spriteKey];
      if (slashImg) {
        ctx.save();
        ctx.translate(mx, my);
        // enkel “pop” (topp i midten av animasjonen)
        const s = 0.7 + Math.sin(t * Math.PI) * 0.6;
        ctx.scale(s, s);
        ctx.globalAlpha = 0.9;

        // roter litt i retning attacker->target
        const ang = Math.atan2(dy, dx);
        ctx.rotate(ang);

        // tegn midtstilt
        ctx.drawImage(slashImg, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);

        ctx.restore();
      } else {
        // fallback: tegn en rask strek i retning attacker->target
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(fx.ax, fx.ay);
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();
        ctx.restore();
      }
    }
  }


  // top layer (synlig område)
  const { startX, startY, endX, endY } = getVisibleTileBounds(camX, camY);
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const key = tileAtLayer(level.grid_top, x, y);
      if (!key || key === EMPTY) continue;

      const img = tileImages[key];
      if (img) {
        ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = "#ff00ff";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  ctx.restore();
}


canvas.addEventListener("contextmenu", (e) => {
  if (isUiBlocked()) return;
  e.preventDefault();

  // Finn tile-koordinat fra musepos
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  const worldX = mouseX + cameraPx;
  const worldY = mouseY + cameraPy;

  const tx = Math.floor(worldX / TILE_SIZE);
  const ty = Math.floor(worldY / TILE_SIZE);

  console.log("Right-click tile:", tx, ty);

  // NPC target?
  const npc = getNpcAt(tx, ty);
  if (npc) {
    const entries = [];

    // Attack hvis hostile
    if (npc.hostile) {
      entries.push({
        label: `Attack ${npc.name}`,
        onClick: () => startCombat(npc)
      });
    }

    entries.push({
      label: `Talk-to ${npc.name}`,
      onClick: () => {
        if (!isAdjacentToPlayer(tx, ty)) {
          logMessage("You need to stand next to the NPC.", "error");
          return;
        }
        openDialogForNpc(npc);
      }
    });

    entries.push({
      label: "Examine",
      onClick: () => {
        logMessage(`${npc.name} ser opptatt ut.`, "system");
      }
    });

    openContextMenu(e.clientX, e.clientY, npc.name, entries);
    return; //ikke fall gjennom til tile-meny
  }


  const target = getTopmostTileKeyAt(tx, ty);
  if (!target) {
    closeContextMenu();
    return;
  }

  const tileDef = TILE_DEFS[target.key];
  const desc = tileDef?.description || "No description.";

  const portal = getPortalAt(tx, ty);

  const entries = [];

  // 1) Description alltid
  entries.push({
    label: "Description",
    onClick: () => {
      // Foreløpig: bare alert. (Vi kan lage et fint UI-panel senere)
      logMessage(desc, "system");
    }
  });

  if (portal) {
    entries.push({
      label: portal.label || "Enter",
      onClick: () => {
        // Må stå ved døra
        if (!isAdjacentToPlayer(tx, ty)) {
          logMessage("You need to stand next to the door.", "error");
          return;
        }

        setLevel(portal.toLevel, null, portal.toSpawn);
        logMessage(`You enter ${LEVELS[portal.toLevel]?.name || portal.toLevel}.`, "system");
      }
    });
  }

  openContextMenu(e.clientX, e.clientY, target.key, entries);
});

const CHAT_MAX_LINES = 8;

function formatTimeHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function logMessage(text, type = "system") {
  if (!chatLogEl) return;

  const line = document.createElement("div");
  line.className = `chatline ${type}`;

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = `[${formatTimeHHMM()}]`;

  const msg = document.createElement("span");
  msg.textContent = text;

  line.appendChild(time);
  line.appendChild(msg);

  chatLogEl.appendChild(line);

  // hold max lines
  while (chatLogEl.children.length > CHAT_MAX_LINES) {
    chatLogEl.removeChild(chatLogEl.firstChild);
  }
}



// ----------- Input (hold-to-walk) -----------
const held = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// Prioritet: sist trykte retning føles best.
// Vi sporer “lastIntent”.
let lastIntent = null;

function setFacingFromDelta(dx, dy) {
  if (dx === 1) player.facing = "right";
  else if (dx === -1) player.facing = "left";
  else if (dy === 1) player.facing = "down";
  else if (dy === -1) player.facing = "up";
}

function intentFromHeld() {
  // hvis lastIntent fortsatt holdes, bruk den
  if (lastIntent && held[lastIntent]) return lastIntent;

  // ellers: velg en som holdes (enkelt)
  if (held.up) return "up";
  if (held.down) return "down";
  if (held.left) return "left";
  if (held.right) return "right";
  return null;
}

function dirToDelta(dir) {
  if (dir === "up") return { dx: 0, dy: -1 };
  if (dir === "down") return { dx: 0, dy: 1 };
  if (dir === "left") return { dx: -1, dy: 0 };
  if (dir === "right") return { dx: 1, dy: 0 };
  return { dx: 0, dy: 0 };
}

// -------------------- PAUSE / START MENU --------------------
let pauseOpen = false;
let pauseIndex = 0;

const PAUSE_ITEMS = [
  { id: "resume", label: "Resume" },
  { id: "save", label: "Save game" },
];

function isUiBlocked() {
  const dialogEl = document.getElementById("dialog"); // kan være null
  const dialogOpen = dialogEl ? !dialogEl.classList.contains("hidden") : false;
  return pauseOpen || dialogOpen || skillsOpen || shopOpen;
}

function renderPauseMenu() {
  if (!pauseItemsEl) return;
  pauseItemsEl.innerHTML = "";

  for (let i = 0; i < PAUSE_ITEMS.length; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pause-item" + (i === pauseIndex && pauseIndex >= 0 ? " selected" : "");
    btn.textContent = PAUSE_ITEMS[i].label;

    // Mouse: hover skal ikke “låse” selection, men klikk skal velge
    btn.addEventListener("mouseenter", () => {
      // valgfritt: IKKE sett pauseIndex her, da forblir highlight kun CSS-hover
    });

    btn.addEventListener("click", () => {
      pauseIndex = i;
      renderPauseMenu();
      pauseSelect();
    });

    pauseItemsEl.appendChild(btn);
  }
}

function openPauseMenu() {
  pauseOpen = true;
  pauseIndex = -1;
  renderPauseMenu();

  pauseMenuEl.classList.remove("hidden");
  pauseMenuEl.setAttribute("aria-hidden", "false");

  // Slipp bevegelse umiddelbart
  held.up = held.down = held.left = held.right = false;
  lastIntent = null;

  // Lukk context menu hvis åpen (actions skal ikke kunne brukes)
  closeContextMenu?.();
}

function closePauseMenu() {
  pauseOpen = false;
  pauseMenuEl.classList.add("hidden");
  pauseMenuEl.setAttribute("aria-hidden", "true");

  // Slipp input for sikkerhet
  held.up = held.down = held.left = held.right = false;
  lastIntent = null;
}

function togglePauseMenu() {
  if (!gameStarted) return; // ikke i main menu / character screen
  pauseOpen ? closePauseMenu() : openPauseMenu();
}

btnInventory?.addEventListener("click", () => {
  toggleInventoryWindow();
});

btnInventoryClose?.addEventListener("click", () => {
  closeInventoryWindow();
});

function pauseMoveSelection(delta) {
  if (pauseIndex < 0) pauseIndex = 0;
  pauseIndex = (pauseIndex + delta + PAUSE_ITEMS.length) % PAUSE_ITEMS.length;
  renderPauseMenu();
}

function pauseSelect() {
  if (pauseIndex < 0) return; // ingenting valgt ennå
  const item = PAUSE_ITEMS[pauseIndex];
  if (!item) return;

  if (item.id === "resume") {
    closePauseMenu();
    return;
  }

  if (item.id === "save") {
    const ok = saveGame?.();
    if (ok) console.log("[SAVE] Manual save (pause menu).");
    else logMessage("Could not save right now.", "error");
    // bli i menyen etter save
  }
}

function startMove(dx, dy) {
  if (isUiBlocked()) return;
  if (player.moving) return;
  closeContextMenu();

  // Hvis du beveger deg mens du fighter: stopp combat (enkelt retreat)
  if (combat.active) {
    stopCombat("You retreat.", performance.now());
  }

  // oppdater facing med en gang (selv om blokkert)
  setFacingFromDelta(dx, dy);

  const nx = player.x + dx;
  const ny = player.y + dy;

  // edge transitions (før vi sjekker walkable)
  if (nx < 0) {
    const target = level.edges.west;
    if (target) setLevel(target, "east");
    return;
  }
  if (nx >= level.width) {
    const target = level.edges.east;
    if (target) setLevel(target, "west");
    return;
  }
  if (ny < 0) {
    const target = level.edges.north;
    if (target) setLevel(target, "south");
    return;
  }
  if (ny >= level.height) {
    const target = level.edges.south;
    if (target) setLevel(target, "north");
    return;
  }

  // kollisjon
  if (!isWalkable(nx, ny)) return;

  // start smooth tween
  player.moving = true;
  player.moveElapsed = 0;

  player.fromPx = player.px;
  player.fromPy = player.py;

  player.toPx = nx * TILE_SIZE;
  player.toPy = ny * TILE_SIZE;

  // oppdater tile-pos med en gang eller ved slutt?
  // For kollisjon/logic: vi oppdaterer ved SLUTT (tryggere)
  player._targetX = nx;
  player._targetY = ny;
}

function updateHud() {
  hudZone.textContent = `${level.name} (${level.id})`;
  hudPos.textContent = `${player.x}, ${player.y}`;
}

const HEART_IMG = "assets/ui/heart.png"; // <--- hjerte bildet

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function renderHearts() {
  if (!heartsEl) return;

  heartsEl.innerHTML = "";

  for (let i = 0; i < player.maxHp; i++) {
    const img = document.createElement("img");
    img.src = HEART_IMG;
    img.alt = i < player.hp ? "Heart" : "Empty heart";
    if (i >= player.hp) img.classList.add("empty");
    heartsEl.appendChild(img);
  }
}

function damagePlayer(amount = 1) {
  player.hp = clamp(player.hp - amount, 0, player.maxHp);
  renderHearts();

  if (player.hp <= 0) {
    logMessage("You died!", "error");
    // foreløpig: respawn med full HP (kan endres senere)
    player.hp = player.maxHp;
    setLevel(currentLevelId, null);
    renderHearts();
  }
}

function healPlayer(amount = 1) {
  player.hp = clamp(player.hp + amount, 0, player.maxHp);
  renderHearts();
}

// --- DIALOG NPC ---
function openDialogForNpc(npc) {
  const dialogId = npc.dialogId;
  const dialog = DIALOGS[dialogId];
  if (!dialog) {
    logMessage(`${npc.name} har ingenting å si.`, "system");
    return;
  }

  setChatVisible(false);
  dialogState.open = true;
  dialogState.npcId = npc.id;
  dialogState.dialogId = dialogId;
  dialogState.nodeId = dialog.start;
  dialogState.optionIndex = -1;

  // stopp bevegelse / slipp input
  held.up = held.down = held.left = held.right = false;
  lastIntent = null;

  // Sett NPC-portrett (bruk sprite foreløpig)
  if (npc.sprite) {
    dialogPortraitEl.style.backgroundImage = `url(${npc.sprite})`;
  } else {
    dialogPortraitEl.style.backgroundImage = "";
  }

  closeContextMenu?.();
  renderDialog();
}

function closeDialog() {
  dialogState.open = false;
  dialogState.npcId = null;
  dialogState.dialogId = null;
  dialogState.nodeId = null;
  dialogState.optionIndex = 0;
  if (gameStarted) setChatVisible(true);

  dialogEl.classList.add("hidden");
  dialogEl.setAttribute("aria-hidden", "true");
  dialogOptionsEl.innerHTML = "";

  dialogPortraitEl.style.backgroundImage = ""; 
}

function runDialogAction(actionId) {
  // legg actions du vil støtte her
  if (actionId === "heal") {
    healPlayer(1);
    logMessage("You feel slightly healthier.", "system");
  }
  if (actionId === "open_shop") {
    const npc = getNpcById(dialogState.npcId);
    closeDialog();
    if (npc) openShopForNpc(npc);
    return;
  }
}

function renderDialog() {
  if (!dialogState.open) return;

  const dialog = DIALOGS[dialogState.dialogId];
  const node = dialog?.nodes?.[dialogState.nodeId];
  if (!node) {
    closeDialog();
    return;
  }

  dialogNameEl.textContent = node.speaker || "Unknown";
  dialogTextEl.textContent = node.text || "";

  dialogOptionsEl.innerHTML = "";

  const npc = getNpcById(dialogState.npcId); // du har getNpcById allerede i combat-seksjonen
  const opts = [...(node.options || [])];

  // Hvis trader: legg inn shop-option øverst
  if (npc?.trader && Array.isArray(npc.shop) && npc.shop.length > 0) {
    opts.unshift({ label: "What do you sell?", action: "open_shop" });
  }

  if (opts.length === 0) {
    // hvis ingen options: vis bare “Close”
    const btn = document.createElement("button");
    btn.className = "dialog-option selected";
    btn.textContent = "Lukk";
    btn.addEventListener("click", closeDialog);
    dialogOptionsEl.appendChild(btn);
    dialogState.optionIndex = 0;
  } else {
    // clamp index
    dialogState.optionIndex = Math.max(0, Math.min(dialogState.optionIndex, opts.length - 1));

    opts.forEach((o, i) => {
      const btn = document.createElement("button");
      btn.className =   "dialog-option" + (dialogState.optionIndex >= 0 && i === dialogState.optionIndex ? " selected" : "");
      btn.type = "button";
      btn.textContent = o.label;

      btn.addEventListener("click", () => {
        dialogState.optionIndex = i;
        selectDialogOption();
      });

      dialogOptionsEl.appendChild(btn);
    });
  }

  dialogEl.classList.remove("hidden");
  dialogEl.setAttribute("aria-hidden", "false");
}

function moveDialogSelection(delta) {
  if (!dialogState.open) return;
  const dialog = DIALOGS[dialogState.dialogId];
  const node = dialog?.nodes?.[dialogState.nodeId];
  const opts = node?.options || [];
  if (opts.length === 0) return;

  if (dialogState.optionIndex < 0) dialogState.optionIndex = 0;

  dialogState.optionIndex = (dialogState.optionIndex + delta + opts.length) % opts.length;
  renderDialog();
}

function selectDialogOption() {
  if (!dialogState.open) return;

  const dialog = DIALOGS[dialogState.dialogId];
  const node = dialog?.nodes?.[dialogState.nodeId];
  const npc = getNpcById(dialogState.npcId);
  const opts = [...(node?.options || [])];

  if (npc?.trader && Array.isArray(npc.shop) && npc.shop.length > 0) {
    opts.unshift({ label: "What do you sell?", action: "open_shop" });
  }

const choice = opts[dialogState.optionIndex];

  if (!choice) return;

  if (choice.action) runDialogAction(choice.action);

  if (choice.end) {
    closeDialog();
    return;
  }

  if (choice.next) {
    dialogState.nodeId = choice.next;
    dialogState.optionIndex = -1;
    renderDialog();
    return;
  }
}

function tryTalkToFacedNpc() {
  if (!gameStarted) return;
  if (isUiBlocked()) return;

  const { x, y } = getFacedTileCoords();
  const npc = getNpcAt(x, y);
  if (!npc) {
    logMessage("Ingen å snakke med der.", "system");
    return;
  }

  // Må stå ved siden av NPCen (samme regel som dører)
  if (!isAdjacentToPlayer(x, y)) {
    logMessage("Du må stå ved siden av NPCen.", "error");
    return;
  }

  openDialogForNpc(npc);
}











// Key handling
function keyToDir(key) {
  const k = key.toLowerCase();
  if (k === "arrowup" || k === "w") return "up";
  if (k === "arrowdown" || k === "s") return "down";
  if (k === "arrowleft" || k === "a") return "left";
  if (k === "arrowright" || k === "d") return "right";
  return null;
}

function isTypingInInput() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}


window.addEventListener("keydown", (e) => {
  // Hvis du skriver i input (f.eks. navn), IKKE stjel WASD
  if (isTypingInInput()) return;

  if (isUiBlocked()) return;

  // Hvis spillet ikke har startet ennå (meny/character screen), IKKE beveg
  if (!gameStarted) return;

  const dir = keyToDir(e.key);
  if (!dir) return;

  e.preventDefault();

  held[dir] = true;
  lastIntent = dir;

  if (!player.moving) {
    const { dx, dy } = dirToDelta(dir);
    startMove(dx, dy);
  }
});

// Disable browser right-click context menu (game-wide)
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  if (isTypingInInput()) return;
  if (!gameStarted) return;

  if (isUiBlocked()) return;

  const dir = keyToDir(e.key);
  if (!dir) return;

  e.preventDefault();
  held[dir] = false;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();

    // Lukk shop først
    if (shopOpen) {
      closeShopWindow();
      return;
    }

    // Så equip
    if (equipOpen) {
      closeEquipWindow();
      return;
    }

    // så inventory 
    if (inventoryOpen) {
      closeInventoryWindow();
      return;
    }

    // Så skills
    if (skillsOpen) {
      closeSkillsWindow();
      return;
    }



    togglePauseMenu();
  }
});

btnEquip?.addEventListener("click", () => {
  toggleEquipWindow();
});

btnEquipClose?.addEventListener("click", () => {
  closeEquipWindow();
});

window.addEventListener("keydown", (e) => {
  if (isTypingInInput()) return;

  // Hvis dialog er åpen: naviger i dialog
  if (dialogState.open) {
    if (e.key === "ArrowUp") { e.preventDefault(); moveDialogSelection(-1); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); moveDialogSelection(1); return; }
    if (e.key === "Enter") { e.preventDefault(); selectDialogOption(); return; }
    if (e.key === "Escape") { e.preventDefault(); closeDialog(); return; }
    return;
  }

  // E / Enter: snakk med NPC foran deg (når ikke i pause)
  if (!isUiBlocked() && gameStarted && (e.key === "e" || e.key === "E")) {
    e.preventDefault();
    tryTalkToFacedNpc();
  }
});

btnSave.addEventListener("click", () => {
  saveGame();
});

btnSkills?.addEventListener("click", () => {
  if (!gameStarted) return;
  skillsOpen ? closeSkillsWindow() : openSkillsWindow();
});

btnSkillsClose?.addEventListener("click", () => {
  closeSkillsWindow();
});

btnEquipClose?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeEquipWindow();
});

window.addEventListener("beforeunload", () => {
  // Bare autosave hvis det faktisk er et ferdig spill (navn+startet)
  if (canWriteSave()) saveGame();
});

// Klikk hvor som helst: lukk meny
window.addEventListener("mousedown", (e) => {
  // hvis du klikker inne i menyen, ikke lukk her (knappene håndterer seg selv)
  if (!contextMenu.classList.contains("hidden") && !contextMenu.contains(e.target)) {
    closeContextMenu();
  }
});
// Hvis du begynner å gå: lukk meny
// (legg dette helt i starten av startMove(dx,dy) hvis du har den funksjonen)


// ----------- Game loop (update + draw) -----------
let lastTime = performance.now();

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function update(dtMs) {
  animTime += dtMs;

  const nowMs = performance.now();
  updateEnemyRegens(nowMs); 
  updateRespawns(nowMs);
  updateCombat(nowMs);
  if (player.moving) {
    player.moveElapsed += dtMs;
    const t = Math.min(1, player.moveElapsed / player.moveDuration);
    // smooth interpolation
    player.px = lerp(player.fromPx, player.toPx, t);
    player.py = lerp(player.fromPy, player.toPy, t);

    if (t >= 1) {
      // bevegelse ferdig: snap og sett tile-pos
      player.px = player.toPx;
      player.py = player.toPy;

      player.x = player._targetX;
      player.y = player._targetY;

      player.moving = false;
      updateHud();

      // Hvis en retning fortsatt holdes: gå videre uten hakking
      const nextDir = intentFromHeld();
      if (nextDir) {
        const { dx, dy } = dirToDelta(nextDir);
        if (STEP_REPEAT_DELAY_MS > 0) {
          setTimeout(() => startMove(dx, dy), STEP_REPEAT_DELAY_MS);
        } else {
          startMove(dx, dy);
        }
      }
    }
  } else {
    // Hvis ikke moving, men en retning holdes: start walking
    const nextDir = intentFromHeld();
    if (nextDir) {
      const { dx, dy } = dirToDelta(nextDir);
      startMove(dx, dy);
    }
  }
}


function loop(now) {
  const dt = now - lastTime;
  lastTime = now;

  // Når pause er åpen: frys gameplay (ikke update)
  if (!pauseOpen) {
    update(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

// ----------- Validation -----------
function validateLevels() {
  for (const [id, lvl] of Object.entries(LEVELS)) {
    const grids = ["grid_base", "grid_mid", "grid_top"];
    for (const g of grids) {
      if (!lvl[g]) {
        console.warn(`[${id}] missing ${g}`);
        continue;
      }
      if (lvl.height !== lvl[g].length) {
        console.warn(`[${id}] ${g} height mismatch: expected=${lvl.height} got=${lvl[g].length}`);
      }
      if (lvl[g][0] && lvl.width !== lvl[g][0].length) {
        console.warn(`[${id}] ${g} width mismatch: expected=${lvl.width} got=${lvl[g][0].length}`);
      }
    }
  }
}

function ensureGridSize(lvl, gridName, fillKey) {
  if (!lvl[gridName]) lvl[gridName] = [];

  // Sørg for riktig antall rader
  while (lvl[gridName].length < lvl.height) {
    lvl[gridName].push([]);
  }

  // Sørg for riktig antall kolonner per rad
  for (let y = 0; y < lvl.height; y++) {
    if (!Array.isArray(lvl[gridName][y])) lvl[gridName][y] = [];
    while (lvl[gridName][y].length < lvl.width) {
      lvl[gridName][y].push(fillKey);
    }
  }
}

function normalizeLevelGrids(lvl) {
  // Base må alltid ha en gyldig tile (typisk grass)
  ensureGridSize(lvl, "grid_base", "grass");

  // Mid/top kan være tomt "."
  ensureGridSize(lvl, "grid_mid", EMPTY);
  ensureGridSize(lvl, "grid_top", EMPTY);
}

let gameStarted = false;

async function startGame(opts = { mode: "load" }) {
  if (gameStarted) return;

  // Hvis du prøver å starte uten gyldig navn: stopp
  const name = getProfileName();
  if (!name || name.trim().length < 2) {
    alert("Du må skrive inn et navn før du kan starte.");
    return;
  }

  gameStarted = true;
  hideAllScreensAndShowGameUI();

  // 1) Først: utvid grids så de matcher width/height (hindrer all “alt blir feil”)
  for (const lvl of Object.values(LEVELS)) {
    normalizeLevelGrids(lvl);
  }

  // 2) Så: valider (nå får du mye færre warnings)
  validateLevels();

  await loadAllAssets();

  if (opts.mode === "new") {
    // NY character: start på spawn
    setLevel(currentLevelId, null);
  } else {
    // Last existing save hvis den er gyldig, ellers ny start
    const ok = loadGame();
    if (!ok) {
      setLevel(currentLevelId, null);
    }
  }
  renderHearts();

  logMessage("Welcome to VoidQuest.", "system");


  // VIKTIG: lag første save med en gang når spillet starter
  // (nå er gameStarted=true og name finnes => canWriteSave() blir true)
  saveGame();

  requestAnimationFrame(loop);
}


// ----------- App start (menu først) -----------
showMenu();

btnPlay.addEventListener("click", () => {
  showCharacterScreen();
});

btnBackMenu.addEventListener("click", () => {
  showMenu();
});

btnStartGame.addEventListener("click", () => {
  // Kun hvis save faktisk er gyldig (har navn)
  if (!hasSave()) {
    showCharacterScreen();
    return;
  }
  startGame({ mode: "load" });
});


btnFinishCharacter.addEventListener("click", () => {
  const name = (inputName.value || "").trim();

  if (name.length < 2) {
    alert("Navnet må være minst 2 tegn.");
    return;
  }

  setProfileName(name);

  // Start som ny character + lag første save før spill
  startGame({ mode: "new" });
});


