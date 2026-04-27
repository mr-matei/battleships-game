/* =========================
   1. CONFIG & STATE
========================= */

const BOARD_SIZE = 10;

const BOAT_NAME_BY_TYPE = {
  patrolBoat: "Patrol Boat",
  submarine: "Submarine",
  destroyer: "Destroyer",
  battleship: "Battleship",
  carrier: "Carrier"
};

const POWER_UPS = {
  shield: {
    name: "Shield",
    idname: "shield",
    icon: "icons/shield.png"
  },
  missile: {
    name: "Missile",
    idname: "missile",
    icon: "icons/missile.png"
  },
  fatMan: {
    name: "Nuke",
    idname: "fatMan",
    icon: "icons/nuke.png"
  },
  pingBullet: {
    name: "Ping Bullet",
    idname: "pingBullet",
    icon: "icons/revealed.png"
  },
  whiteFlag: {
    name: "White Flag",
    idname: "whiteFlag",
    icon: "icons/whiteflag.png"
  }
};

const dx = [0, 0, 1, -1, 1, 1, -1, -1];
const dy = [1, -1, 0, 0, -1, 1, 1, -1];

let currentPlayer = 1;
let player = [];
let gamePhase = "starting";
let hoveredCell = null;
let currentBoatId = [0, 0, 0];
let orientation = "horizontal";
let currentBoatSize = 0;
let currentBoatType = "";
let currentBoatCells = [];
let lastPressedButtonId = "";

let supplyBoatDelay = [0, -1, -1];
let supplyBoatId = [0, 0, 0];

let selectedPowerup = "";
let selectedPowerupId = "";
let whiteFlagActive = false;

/* =========================
   2. DOM REFERENCES
========================= */

const sidebar = document.querySelector(".sidebar");
const startgameOverlay = document.querySelector(".startgame-overlay");

/* =========================
   3. GENERIC HELPERS
========================= */

function otherPlayer() {
  if (currentPlayer === 1) {
    return 2;
  }
  return 1;
}

function isOtherBoard(boardId) {
  return boardId === "player" + otherPlayer() + "-board";
}

function isPlayerBoard(boardId) {
  return boardId === "player" + currentPlayer + "-board";
}

function revealedCell(board, x, y) {
  if (board[x][y].revealedByPing === true || board[x][y].cellHit === true || board[x][y].shieldState === 2) {
    return true;
  }
  return false;
}

function selectButton(id) {
  if (id === "") {
    return;
  }
  document.getElementById(id).classList.add("selected");
}

function deselectButton(id) {
  if (id === "") {
    return;
  }
  document.getElementById(id).classList.remove("selected");
}

function clearButton(id) {
  if (id === "") {
    return;
  }
  document.getElementById(id).classList.remove("selected");
  document.getElementById(id).classList.add("cleared-button");
}

/* =========================
   4. PLAYER & BOARD SETUP
========================= */

function createPlayer() {
  let obj = {
    name: "",
    board: [],
    boatType: {
      patrolBoat: 2,
      submarine: 2,
      destroyer: 1,
      battleship: 1,
      carrier: 1
    },
    totalBoats: 0,
    placedBoats: [],
    boatName: [],
    inventory: [],
    color: ""
  };
  obj.totalBoats = obj.boatType.patrolBoat + obj.boatType.submarine + obj.boatType.destroyer + obj.boatType.battleship + obj.boatType.carrier;
  return obj;
}

function renderHitCell(board, x, y) {
  board[x][y].div.classList.add("hit-cell");
  if (board[x][y].placedBoatId === 0) {
    return;
  }
  if (board[x][y].isSupply === false) {
    board[x][y].div.classList.add("placed-boat-player" + otherPlayer());
  } else {
    board[x][y].div.classList.add("supply-boat");
  }
}

function renderBoards(playerId) {
  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      player[playerId].board[i][j].div.classList.add("cell-style");
      if (player[playerId].board[i][j].isSupply === true) {
        player[playerId].board[i][j].div.classList.add("supply-boat");
      } else if (player[playerId].board[i][j].placedBoatId != 0) {
        player[playerId].board[i][j].div.classList.add("placed-boat-player" + playerId);
      }
      if (player[playerId].board[i][j].cellHit === true) {
        player[playerId].board[i][j].div.classList.add("hit-cell");
      } else if (player[playerId].board[i][j].shieldState === 1) {
        player[playerId].board[i][j].div.classList.add("shield-cell");
      } else if (player[playerId].board[i][j].shieldState === 2) {
        player[playerId].board[i][j].div.classList.add("broken-shield");
      } else if (player[playerId].board[i][j].revealedByPing === true) {
        player[playerId].board[i][j].div.classList.add("revealed");
      }
    }
  }

  playerId = otherPlayer();

  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      if (revealedCell(player[playerId].board, i, j)) {
        player[playerId].board[i][j].div.classList.remove("board-cover");
        if (player[playerId].board[i][j].cellHit === true) {
          renderHitCell(player[playerId].board, i, j);
        } else if (player[playerId].board[i][j].shieldState === 1) {
          renderHitCell(player[playerId].board, i, j);
          player[playerId].board[i][j].div.classList.remove("hit-cell");
          player[playerId].board[i][j].div.classList.add("shield-cell");
        } else if (player[playerId].board[i][j].shieldState === 2) {
          renderHitCell(player[playerId].board, i, j);
          player[playerId].board[i][j].div.classList.remove("hit-cell");
          player[playerId].board[i][j].div.classList.add("broken-shield");
        } else if (player[playerId].board[i][j].revealedByPing === true) {
          renderHitCell(player[playerId].board, i, j);
          player[playerId].board[i][j].div.classList.remove("hit-cell");
          player[playerId].board[i][j].div.classList.add("revealed");
        }
      }
    }
  }
}

function isValidMove(boardId) {
  if (gamePhase === "placement") {
    if (isOtherBoard(boardId)) {
      return false;
    }
  } else if (gamePhase === "battle") {
    if (selectedPowerup !== "pingBullet" && hoveredCell.cellData.cellHit === true) {
      return false;
    }
    if (isOtherBoard(boardId) && selectedPowerup === "shield") {
      return false;
    }
    if (isPlayerBoard(boardId)) {
      if (selectedPowerup === "missile" || selectedPowerup === "fatMan" || selectedPowerup === "pingBullet" || selectedPowerup === "whiteFlag") {
        return false;
      }
      if (selectedPowerup === "shield") {
        if (hoveredCell.cellData.shieldState !== 0) {
          return false;
        }
        if (hoveredCell.cellData.placedBoatId === 0) {
          return false;
        }
      } else if (isSupplyBoat() === false) {
        return false;
      }
    }
  } else if (gamePhase === "supplyPlacement") {
    if (isOtherBoard(boardId)) {
      return false;
    }
    if (isPlayerBoard(boardId) && hoveredCell.cellData.placedBoatId === 0) {
      return false;
    }
  }
  return true;
}

/* =========================
   5. SAVE / LOAD
========================= */

function getSerializableBoard(playerBoard) {
  let cleanBoard = [];
  for (let i = 0; i < BOARD_SIZE; ++i) {
    cleanBoard[i] = [];
    for (let j = 0; j < BOARD_SIZE; ++j) {
      cleanBoard[i][j] = {
        x: playerBoard[i][j].x,
        y: playerBoard[i][j].y,
        placed: playerBoard[i][j].placed,
        placedBoatId: playerBoard[i][j].placedBoatId,
        cellHit: playerBoard[i][j].cellHit,
        isSupply: playerBoard[i][j].isSupply,
        shieldState: playerBoard[i][j].shieldState,
        revealedByPing: playerBoard[i][j].revealedByPing,
        boardId: playerBoard[i][j].boardId
      };
    }
  }
  return cleanBoard;
}

function getSerializablePlayer(playerData) {
  return {
    name: playerData.name,
    board: getSerializableBoard(playerData.board),
    boatType: playerData.boatType,
    totalBoats: playerData.totalBoats,
    placedBoats: playerData.placedBoats,
    boatName: playerData.boatName,
    inventory: playerData.inventory
  };
}

function getGameState() {
  return {
    gamePhase,
    currentPlayer,
    whiteFlagActive,
    currentBoatId: {
      1: currentBoatId[1],
      2: currentBoatId[2]
    },
    player: {
      1: getSerializablePlayer(player[1]),
      2: getSerializablePlayer(player[2])
    },
    supplyBoatDelay: {
      1: supplyBoatDelay[1],
      2: supplyBoatDelay[2]
    },
    supplyBoatId: {
      1: supplyBoatId[1],
      2: supplyBoatId[2]
    }
  };
}

function updatePlayer(gameSave, playerId) {
  player[playerId].name = gameSave.player[playerId].name;
  player[playerId].boatType = gameSave.player[playerId].boatType;
  player[playerId].totalBoats = gameSave.player[playerId].totalBoats;
  player[playerId].placedBoats = gameSave.player[playerId].placedBoats;
  player[playerId].boatName = gameSave.player[playerId].boatName;
  player[playerId].inventory = gameSave.player[playerId].inventory;
  console.log(player[playerId]);

  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      player[playerId].board[i][j].x = gameSave.player[playerId].board[i][j].x;
      player[playerId].board[i][j].y = gameSave.player[playerId].board[i][j].y;
      player[playerId].board[i][j].placed = gameSave.player[playerId].board[i][j].placed;
      player[playerId].board[i][j].placedBoatId = gameSave.player[playerId].board[i][j].placedBoatId;
      player[playerId].board[i][j].cellHit = gameSave.player[playerId].board[i][j].cellHit;
      player[playerId].board[i][j].isSupply = gameSave.player[playerId].board[i][j].isSupply;
      player[playerId].board[i][j].shieldState = gameSave.player[playerId].board[i][j].shieldState;
      player[playerId].board[i][j].revealedByPing = gameSave.player[playerId].board[i][j].revealedByPing;
      player[playerId].board[i][j].boardId = gameSave.player[playerId].board[i][j].boardId;
    }
  }
}

function clearGame() {
  hoveredCell = null;
  orientation = "horizontal";
  currentBoatSize = 0;
  currentBoatType = "";
  currentBoatCells = [];
  deselectButton(lastPressedButtonId);
  lastPressedButtonId = "";

  for (let playerId = 1; playerId <= 2; ++playerId) {
    for (let i = 0; i < BOARD_SIZE; ++i) {
      for (let j = 0; j < BOARD_SIZE; ++j) {
        player[playerId].board[i][j].div.className = "cell-style";
      }
    }
  }
}

function loadGame(gameSave) {
  clearGame();
  console.log(gameSave);
  gamePhase = gameSave.gamePhase;
  currentPlayer = gameSave.currentPlayer;
  whiteFlagActive = gameSave.whiteFlagActive;

  for (let i = 1; i <= 2; ++i) {
    currentBoatId[i] = gameSave.currentBoatId[i];
    updatePlayer(gameSave, i);
    supplyBoatDelay[i] = gameSave.supplyBoatDelay[i];
    supplyBoatId[i] = gameSave.supplyBoatId[i];
  }

  startGame();
  renderBoards(currentPlayer);
}

async function saveGame() {
  try {
    const gameState = getGameState();
    if (!gameState.player[1].name || !gameState.player[2].name) {
      alert("Unul dintre jucatori nu are nume!");
      return;
    }

    const response = await fetch("/save-game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(gameState)
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(data.error);
      return;
    }

    console.log("Salvare reusita:", data);
    alert(data.message);
  } catch (error) {
    console.error("Eroare la salvare:", error);
    alert("A aparut o eroare la salvare.");
  }
}

async function showSavedGames() {
  try {
    const response = await fetch("/saved-games");
    const data = await response.json();
    if (!response.ok) {
      console.error(data.error);
      return;
    }

    data.forEach(element => {
      const date = new Date(element.created_at);
      element.created_at = date.toLocaleString("ro-RO");
    });

    renderSavedGamesList(data);
  } catch (error) {
    console.error("Eroare la obtinerea listei de salvari:", error);
    alert("A aparut o eroare la obtinerea listei de salvari.");
  }
}

async function getSave(id) {
  try {
    const response = await fetch(`/load-game/${id}`);
    const data = await response.json();
    if (!response.ok) {
      console.error(data.error);
      return;
    }

    loadGame(data);
  } catch (error) {
    console.error("Eroare la obtinerea salvarii:", error);
    alert("A aparut o eroare la obtinerea salvarii.");
  }
}

/* =========================
   6. INVENTORY & POWER-UPS
========================= */

function getRandomPowerup() {
  let keys = Object.keys(POWER_UPS);
  let length = keys.length;
  if (whiteFlagActive) {
    --length;
  }
  let index = Math.floor(Math.random() * length);
  let type = keys[index];
  return POWER_UPS[type];
}

function resetPowerup() {
  selectedPowerup = "";
  selectedPowerupId = "";
}

function resetWhiteFlag() {
  whiteFlagActive = false;
}

function managePowerup(playerId, powerUp) {
  if (player[playerId].inventory.length === 2) {
    player[playerId].inventory.shift();
  }
  player[playerId].inventory.push(powerUp);
}

function clearPowerup(id) {
  let index = id[id.length - 1];
  console.log(index, player[currentPlayer].inventory);
  player[currentPlayer].inventory.splice(index, 1);
}

function renderInventory(playerId) {
  resetPowerup();
  let inventoryDiv = document.querySelector(".player-inventory");
  inventoryDiv.innerHTML = "";
  inventoryDiv.classList.remove("empty-inventory-text");

  if (player[playerId].inventory.length === 0) {
    inventoryDiv.innerHTML = "Inventory is empty";
    inventoryDiv.classList.add("empty-inventory-text");
    return;
  }

  let inventory = player[playerId].inventory;
  for (let i = 0; i < inventory.length; ++i) {
    let powerupDiv = document.createElement("div");
    powerupDiv.classList.add("player-powerup-div");
    powerupDiv.id = "player" + playerId + "-powerup" + i;

    let powerupText = document.createElement("div");
    powerupText.innerHTML = `${inventory[i].name}`;
    powerupText.classList.add("player-powerup-div-text");
    powerupDiv.appendChild(powerupText);

    let img = document.createElement("img");
    img.src = inventory[i].icon;
    img.classList.add("player-powerup-div-image");
    powerupDiv.appendChild(img);

    powerupDiv.addEventListener("click", function() {
      if (selectedPowerupId === powerupDiv.id) {
        if (selectedPowerup === "whiteFlag") {
          resetWhiteFlag();
        }
        deselectButton(powerupDiv.id);
        resetPowerup();
      } else {
        deselectButton(selectedPowerupId);
        resetPowerup();
        resetWhiteFlag();
        selectedPowerup = inventory[i].idname;
        selectedPowerupId = powerupDiv.id;
        if (selectedPowerup === "whiteFlag") {
          whiteFlagActive = true;
        }
        selectButton(selectedPowerupId);
      }
      renderGameStats(playerId, "");
    });

    inventoryDiv.appendChild(powerupDiv);
  }
}

function revealBoat() {
  let id = hoveredCell.cellData.placedBoatId;
  let board = hoveredCell.board;

  if (id !== 0) {
    for (let i = 0; i < BOARD_SIZE; ++i) {
      for (let j = 0; j < BOARD_SIZE; ++j) {
        if (board[i][j].placedBoatId === id) {
          if (!board[i][j].cellHit && board[i][j].shieldState === 0) {
            board[i][j].div.classList.add("revealed");
          }
          board[i][j].revealedByPing = true;
          board[i][j].div.classList.remove("board-cover");
        }
      }
    }
  } else {
    hoveredCell.cellData.cellHit = true;
    hoveredCell.div.classList.remove("board-cover");
    hoveredCell.div.classList.add("hit-cell");
  }
}

/* =========================
   7. BOAT & SUPPLY HELPERS
========================= */

function renderBoatButtons(playerId) {
  document.getElementById("patrolBoat").innerHTML = "x" + player[playerId].boatType.patrolBoat;
  document.getElementById("patrolBoat").classList.remove("cleared-button");
  document.getElementById("submarine").innerHTML = "x" + player[playerId].boatType.submarine;
  document.getElementById("submarine").classList.remove("cleared-button");
  document.getElementById("destroyer").innerHTML = "x" + player[playerId].boatType.destroyer;
  document.getElementById("destroyer").classList.remove("cleared-button");
  document.getElementById("battleship").innerHTML = "x" + player[playerId].boatType.battleship;
  document.getElementById("battleship").classList.remove("cleared-button");
  document.getElementById("carrier").innerHTML = "x" + player[playerId].boatType.carrier;
  document.getElementById("carrier").classList.remove("cleared-button");
}

function selectBoat(id) {
  if (player[currentPlayer].boatType[id] === 0) {
    return;
  }
  if (id === lastPressedButtonId) {
    deselectButton(lastPressedButtonId);
    lastPressedButtonId = "";
    currentBoatType = "";
    currentBoatSize = 0;
    renderGameStats(currentPlayer);
    return;
  } else {
    deselectButton(lastPressedButtonId);
    selectButton(id);
    lastPressedButtonId = id;
  }
  orientation = "horizontal";
  currentBoatType = id;

  if (id === "patrolBoat") {
    currentBoatSize = 2;
  } else if (id === "submarine" || id === "destroyer") {
    currentBoatSize = 3;
  } else if (id === "battleship") {
    currentBoatSize = 4;
  } else {
    currentBoatSize = 5;
  }
  renderGameStats(currentPlayer, "");
}

function isSupplyBoat() {
  return hoveredCell.cellData.boardId === "player" + currentPlayer + "-board"
    && hoveredCell.cellData.isSupply;
}

function supplyBoatReady() {
  return supplyBoatDelay[currentPlayer] === -1;
}

function isSupplyBoatDestroyed(playerId) {
  let board = player[playerId].board;
  let id = supplyBoatId[playerId];
  if (id === 0) {
    return false;
  }

  let supplyBoatCells = player[playerId].placedBoats[id];
  for (let i = 0; i < supplyBoatCells.length; ++i) {
    let x = supplyBoatCells[i].x;
    let y = supplyBoatCells[i].y;
    if (board[x][y].cellHit === false) {
      return false;
    }
  }

  supplyBoatDelay[playerId] = -1;
  return true;
}

function supplyBoatArrivedAndOk(playerId) {
  if (isSupplyBoatDestroyed(playerId)) {
    supplyBoatDelay[playerId] = -1;
    return false;
  }
  if (supplyBoatDelay[playerId] === 3) {
    return true;
  }
  return false;
}

function startSupplyCountdown() {
  supplyBoatDelay[currentPlayer] = 0;
}

/* =========================
   8. PREVIEW & CELL RENDERING
========================= */

function showShieldPreview() {
  hoveredCell.div.classList.remove("revealed");
  hoveredCell.div.classList.add("shield-cell");
  currentBoatCells.push({ x: hoveredCell.x, y: hoveredCell.y });
}

function showMissilePreview() {
  let x = hoveredCell.x;
  let y = hoveredCell.y;
  let board = hoveredCell.board;

  for (let d = 4; d < 8; ++d) {
    let vx = x + dx[d];
    let vy = y + dy[d];
    if (vx >= 0 && vx <= 9 && vy >= 0 && vy <= 9 && !board[vx][vy].cellHit) {
      board[vx][vy].div.classList.remove("revealed");
      if (board[vx][vy].shieldState !== 0) {
        board[vx][vy].div.classList.remove("shield-cell");
        board[vx][vy].div.classList.remove("broken-shield");
      }
      board[vx][vy].div.classList.add("preview-attack");
      currentBoatCells.push({ x: vx, y: vy });
    }
  }
}

function showNukePreview() {
  let x = hoveredCell.x;
  let y = hoveredCell.y;
  let board = hoveredCell.board;

  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      if ((i - x) * (i - x) + (j - y) * (j - y) <= 4) {
        board[i][j].div.classList.remove("revealed");
        if (board[i][j].shieldState !== 0) {
          board[i][j].div.classList.remove("shield-cell");
          board[i][j].div.classList.remove("broken-shield");
        }
        board[i][j].div.classList.add("preview-attack");
        currentBoatCells.push({ x: i, y: j });
      }
    }
  }
}

function showBattlePreview() {
  if (isSupplyBoat()) {
    if (supplyBoatReady() && !isSupplyBoatDestroyed(currentPlayer)) {
      renderGameStats(currentPlayer, "supplyExpedition");
      let board = hoveredCell.board;
      let id = hoveredCell.cellData.placedBoatId;
      for (let i = 0; i < BOARD_SIZE; ++i) {
        for (let j = 0; j < BOARD_SIZE; ++j) {
          if (board[i][j].placedBoatId === id) {
            board[i][j].div.classList.add("selected");
            currentBoatCells.push({ x: i, y: j });
          }
        }
      }
      if (player[currentPlayer].inventory.length === 2) {
        console.log("URMATORUL POWERUP ITI VA ELIMINA PRIMUL POWERUP DIN INVENTAR");
      }
    }
  } else if (selectedPowerup === "fatMan") {
    showNukePreview();
  } else {
    hoveredCell.div.classList.remove("revealed");
    if (hoveredCell.cellData.shieldState !== 0) {
      hoveredCell.div.classList.remove("shield-cell");
      hoveredCell.div.classList.remove("broken-shield");
    }
    hoveredCell.div.classList.add("preview-attack");
    currentBoatCells.push({ x: hoveredCell.x, y: hoveredCell.y });

    if (selectedPowerup === "missile") {
      showMissilePreview();
    }
    if (selectedPowerup === "pingBullet") {
      hoveredCell.div.classList.remove("hit-cell");
    }
  }
}

function showSupplyPlacementPreview() {
  if (hoveredCell.cellData.placedBoatId === 0) {
    return;
  }

  let board = hoveredCell.board;
  let id = hoveredCell.cellData.placedBoatId;
  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      if (board[i][j].placedBoatId === id) {
        board[i][j].div.classList.remove("placed-boat-player" + currentPlayer);
        board[i][j].div.classList.add("supply-boat");
        currentBoatCells.push({ x: i, y: j });
      }
    }
  }
}

function showPlacementPreview() {
  if (orientation === "horizontal") {
    if (hoveredCell.y + currentBoatSize - 1 > 9) {
      return;
    }
    for (let j = 0; j < currentBoatSize; ++j) {
      let k = hoveredCell.y + j;
      if (hoveredCell.board[hoveredCell.x][k].placed) {
        deletePreview();
        return;
      }
      hoveredCell.board[hoveredCell.x][k].div.classList.add("preview-boat");
      currentBoatCells.push({ x: hoveredCell.x, y: k });
    }
  } else {
    if (hoveredCell.x + currentBoatSize - 1 > 9) {
      return;
    }
    for (let i = 0; i < currentBoatSize; ++i) {
      let k = hoveredCell.x + i;
      if (hoveredCell.board[k][hoveredCell.y].placed) {
        deletePreview();
        return;
      }
      hoveredCell.board[k][hoveredCell.y].div.classList.add("preview-boat");
      currentBoatCells.push({ x: k, y: hoveredCell.y });
    }
  }
}

function deletePreview() {
  if (currentBoatCells.length === 0) {
    return;
  }

  let board = hoveredCell.board;
  for (let i = 0; i < currentBoatCells.length; ++i) {
    let x = currentBoatCells[i].x;
    let y = currentBoatCells[i].y;

    if (gamePhase === "placement") {
      if (board[x][y].placed === false) {
        board[x][y].div.classList.remove("preview-boat");
      }
    }

    if (gamePhase === "battle") {
      if (selectedPowerup === "shield") {
        if (board[x][y].shieldState === 0) {
          board[x][y].div.classList.remove("shield-cell");
          if (board[x][y].revealedByPing === true) {
            board[x][y].div.classList.add("revealed");
          }
        }
      } else if (board[x][y].boardId === "player" + currentPlayer + "-board") {
        board[x][y].div.classList.remove("selected");
        renderGameStats(currentPlayer, "");
      } else if (board[x][y].cellHit === false) {
        board[x][y].div.classList.remove("preview-attack");
        if (board[x][y].shieldState === 1) {
          if (revealedCell(board, x, y)) {
            board[x][y].div.classList.add("shield-cell");
          }
        } else if (board[x][y].shieldState === 2) {
          board[x][y].div.classList.add("broken-shield");
        } else if (board[x][y].revealedByPing === true) {
          board[x][y].div.classList.add("revealed");
        }
      } else if (selectedPowerup === "pingBullet") {
        board[x][y].div.classList.remove("preview-attack");
        board[x][y].div.classList.add("hit-cell");
      }
    }

    if (gamePhase === "supplyPlacement") {
      if (board[x][y].isSupply === false) {
        board[x][y].div.classList.remove("supply-boat");
        board[x][y].div.classList.add("placed-boat-player" + currentPlayer);
      }
    }
  }

  currentBoatCells.length = 0;
  hoveredCell = null;
}

function renderGame() {
  currentBoatCells.length = 0;
  if (gamePhase === "placement") {
    showPlacementPreview();
  } else if (gamePhase === "battle") {
    if (selectedPowerup === "shield") {
      showShieldPreview();
    } else {
      showBattlePreview();
    }
  } else {
    showSupplyPlacementPreview();
  }
}

/* =========================
   9. HUD & OVERLAYS
========================= */

function isGameDone(playerId) {
  if (gamePhase !== "battle") {
    return false;
  }
  let board = player[playerId].board;
  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      if (board[i][j].placedBoatId != 0 && board[i][j].cellHit === false) {
        return false;
      }
    }
  }
  return true;
}

function closeGame() {
  location.reload()
}

function showOverlay() {
  document.getElementById("cover1").classList.remove("hidden");
  document.getElementById("cover2").classList.remove("hidden");
  if (isGameDone(otherPlayer())) {
    const endOverlay = document.querySelector(".end-overlay");
    endOverlay.style.display = "flex";
    endOverlay.style.pointerEvents = "none";
    document.querySelector(".end-overlay-text").innerHTML = `Jucătorul ${player[currentPlayer].name} a caștigat! <br> (click oriunde pentru a deschide meniul)`;
    setTimeout(() => {
      endOverlay.style.pointerEvents = "auto";
    }, 2000);
    return;
  }
  document.querySelector(".overlay").style.display = "flex";
  document.querySelector(".overlay-text").innerHTML = `Este randul lui ${player[otherPlayer()].name} <br> (click oriunde pentru a continua)`;
}

function renderPlayerColour(playerId) {
  deselectButton(lastPressedButtonId);
  lastPressedButtonId = "";

  let className = "player" + playerId + "-hudcolour";
  let removeClass = "player" + otherPlayer() + "-hudcolour";
  document.querySelector(".game-grid").classList.remove(removeClass);
  document.querySelector(".game-grid").classList.add(className);

  let buttons = document.querySelectorAll(".boat-select-button");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove(removeClass);
    buttons[i].classList.add(className);
  }

  let powerUps = document.querySelectorAll(".player-powerup-div");
  for (let i = 0; i < powerUps.length; i++) {
    powerUps[i].classList.remove(removeClass);
    powerUps[i].classList.add(className);
  }

  let statPanels = document.querySelectorAll(".stats-panel");
  for (let i = 0; i < statPanels.length; i++) {
    statPanels[i].classList.remove(removeClass);
    statPanels[i].classList.add(className);
  }
}

function renderFleet(playerId) {
  let mainDiv = document.querySelector(".fleet-hud");
  mainDiv.style.display = "flex";
  mainDiv.innerHTML = "";

  let board = player[playerId].board;
  let placedBoats = player[playerId].placedBoats;
  for (let boatId = 1; boatId < placedBoats.length; ++boatId) {
    let boatDiv = document.createElement("div");
    boatDiv.classList.add("boat-hud");

    let boatText = document.createElement("div");
    boatText.classList.add("boat-text");
    boatText.innerHTML = player[playerId].boatName[boatId];

    let boatState = document.createElement("div");
    boatState.classList.add("boat-stats");

    for (let i = 0; i < placedBoats[boatId].length; ++i) {
      let x = placedBoats[boatId][i].x;
      let y = placedBoats[boatId][i].y;
      let cell = document.createElement("div");
      cell.classList.add("boat-hud-cellstyle");

      if (board[x][y].isSupply === true) {
        cell.classList.add("supply-boat");
      } else {
        cell.classList.add("placed-boat-player" + playerId);
      }

      if (board[x][y].cellHit === true) {
        cell.classList.add("hit-cell");
      } else if (board[x][y].shieldState === 1) {
        cell.classList.add("shield-cell");
      } else if (board[x][y].shieldState === 2) {
        cell.classList.add("broken-shield");
      } else if (board[x][y].revealedByPing === true) {
        cell.classList.add("revealed");
      }

      boatState.appendChild(cell);
    }

    boatDiv.appendChild(boatText);
    boatDiv.appendChild(boatState);
    mainDiv.appendChild(boatDiv);
    console.log(placedBoats[boatId]);
  }
}

function openSidebar() {
  sidebar.classList.add("open");
  startgameOverlay.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  startgameOverlay.classList.remove("show");
  document.querySelector(".savedlist-overlay").classList.remove("show");
  document.querySelector(".rules-overlay").classList.remove("show");
}

function renderSavedGamesList(saved_games) {
  let overlay = document.querySelector(".savedlist-overlay");
  if (overlay.classList.contains("show")) {
    overlay.classList.remove("show");
    return;
  }

  document.querySelector(".rules-overlay").classList.remove("show");
  overlay.classList.add("show");

  if (saved_games.length === 0) {
    overlay.innerHTML = "Niciun joc salvat.";
    overlay.classList.add("none");
    return;
  }

  overlay.innerHTML = "<div class=\"saved-games-list\"></div>";
  overlay.classList.remove("none");

  let mainDiv = document.querySelector(".saved-games-list");
  mainDiv.innerHTML = "";

  let columnNames = document.createElement("div");
  columnNames.classList.add("save-div");
  columnNames.innerHTML = "<div>Save Name</div><div>Created At</div>";
  mainDiv.appendChild(columnNames);

  for (let i = 0; i < saved_games.length; ++i) {
    let saveDiv = document.createElement("div");
    saveDiv.classList.add("save-div");

    let saveName = document.createElement("div");
    saveName.innerHTML = saved_games[i].name;
    saveName.title = saved_games[i].name;

    let saveDate = document.createElement("div");
    saveDate.innerHTML = saved_games[i].created_at;

    let loadButton = document.createElement("button");
    loadButton.innerHTML = "LOAD";
    loadButton.classList.add("ui-button");
    loadButton.style.height = "40px";
    loadButton.addEventListener("click", function() {
      getSave(saved_games[i].id);
    });

    saveDiv.appendChild(saveName);
    saveDiv.appendChild(saveDate);
    saveDiv.appendChild(loadButton);
    mainDiv.appendChild(saveDiv);
  }
}

function showRules() {
  const overlay = document.querySelector(".rules-overlay");
  if (overlay.classList.contains("show")) {
    overlay.classList.remove("show");
    return;
  }
  overlay.classList.add("show");
  document.querySelector(".savedlist-overlay").classList.remove("show");
}

function startGame() {
  let menuButtons = document.querySelectorAll(".menu-button");
  for (let i = 0; i < menuButtons.length; ++i) {
    menuButtons[i].classList.remove("hidden");
  }

  closeSidebar();
  renderInventory(currentPlayer);
  renderBoatButtons(currentPlayer);
  renderPlayerColour(currentPlayer);
  renderGameStats(currentPlayer, "");
  renderFleet(currentPlayer);

  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      player[otherPlayer()].board[i][j].div.classList.add("board-cover");
    }
  }
}

let gamePhaseName = [];
gamePhaseName["placement"] = "Place your boats";
gamePhaseName["supplyPlacement"] = "Select your supply boat";
gamePhaseName["battle"] = "Battle";

function renderGameStats(playerId, request) {
  document.getElementById("currentPlayer").innerHTML = `Player ${playerId}: ${player[playerId].name}`;
  document.getElementById("gamePhase").innerHTML = `Phase: ${gamePhaseName[gamePhase]}`;
  
  const selectedAction = document.getElementById("selected-action");
  const selectedActionHint = document.getElementById("selected-hint");

  if (gamePhase === "placement") {
    if (!currentBoatType) {
      selectedAction.innerHTML = "";
    } else {
      selectedAction.innerHTML = BOAT_NAME_BY_TYPE[currentBoatType];
      if (player[playerId].boatType[currentBoatType] === 0) {
        selectedAction.innerHTML = "No more boats of this type";
      }
    }

  } else if (gamePhase === "supplyPlacement") {
    selectedAction.innerHTML = "";
    if (hoveredCell === null) {
      return;
    }
    if (isOtherBoard(hoveredCell.cellData.boardId)) {
      return;
    }
    if (hoveredCell.cellData.placedBoatId === 0) {
      return;
    }
    selectedAction.innerHTML = "Make this boat your supply boat";

  } else if (gamePhase === "battle") {
    selectedAction.innerHTML = "";
    selectedActionHint.innerHTML = "";

    if (request === "supplyExpedition") {
      selectedAction.innerHTML = "Supply Boat";
      selectedActionHint.innerHTML = "Send the Supply Boat on an expedition. It returns after 2 turns with a power-up.";
      return;
    }

    if (selectedPowerup === "shield") {
      selectedAction.innerHTML = "Shield";
      selectedActionHint.innerHTML = "Select a cell from one of your ships. The shield absorbs the first hit on that cell.";

    } else if (selectedPowerup === "pingBullet") {
      selectedAction.innerHTML = "Ping Bullet";
      selectedActionHint.innerHTML = "Select any enemy cell, even a previously hit one. If it belongs to a ship, the entire ship is revealed.";

    } else if (selectedPowerup === "missile") {
      selectedAction.innerHTML = "Missile";
      selectedActionHint.innerHTML = "Select an enemy cell. The missile hits the target and the 4 diagonal cells around it.";

    } else if (selectedPowerup === "fatMan") {
      selectedAction.innerHTML = "Nuke";
      selectedActionHint.innerHTML = "Select an enemy cell. The nuke hits all cells within a circular radius of 2.";

    } else if (selectedPowerup === "whiteFlag") {
      selectedAction.innerHTML = "White Flag";
      selectedActionHint.innerHTML = "Completely destroys the next ship hit, regardless of the owner. Remains active until triggered.";

    } else {
      selectedAction.innerHTML = "Normal Attack";
      selectedActionHint.innerHTML = "Target an enemy cell and fire.";
    }
  }

  //supply boat stats
  const supplyDelayDiv = document.getElementById("supply-delay");
  const supplyBoatStatus = document.getElementById("supply-status");
  supplyDelayDiv.innerHTML = "";
  supplyBoatStatus.innerHTML = "";
  if (supplyBoatId[playerId] === 0) {
    supplyBoatStatus.innerHTML = "Status: Not selected";
  } else if (isSupplyBoatDestroyed(playerId)) {
    supplyBoatStatus.innerHTML = "Status: Destroyed";
  } else if (supplyBoatDelay[playerId] === -1) {
    supplyBoatStatus.innerHTML = "Status: Not sent in expedition";
  } else {
    supplyDelayDiv.innerHTML = `Returning in: ${3 - supplyBoatDelay[playerId]} turns`;
    supplyBoatStatus.innerHTML = "Status: In expedition";
  }
}

/* =========================
   10. TURN FLOW
========================= */

function switchTurn() {
  let currentBoard = player[currentPlayer].board;
  let otherBoard = player[otherPlayer()].board;

  for (let i = 0; i < BOARD_SIZE; ++i) {
    for (let j = 0; j < BOARD_SIZE; ++j) {
      if (!revealedCell(currentBoard, i, j)) {
        if (currentBoard[i][j].isSupply === false) {
          currentBoard[i][j].div.classList.remove("placed-boat-player" + currentPlayer);
        } else {
          currentBoard[i][j].div.classList.remove("supply-boat");
        }
        currentBoard[i][j].div.classList.add("board-cover");
        currentBoard[i][j].div.classList.remove("shield-cell");
      }

      if (otherBoard[i][j].placedBoatId !== 0) {
        if (otherBoard[i][j].isSupply === false) {
          otherBoard[i][j].div.classList.add("placed-boat-player" + otherPlayer());
        } else {
          otherBoard[i][j].div.classList.add("supply-boat");
        }
        if (otherBoard[i][j].shieldState === 1) {
          otherBoard[i][j].div.classList.add("shield-cell");
        }
      }

      otherBoard[i][j].div.classList.remove("board-cover");
    }
  }

  if (supplyBoatDelay[currentPlayer] !== -1) {
    ++supplyBoatDelay[currentPlayer];
  }

  currentPlayer = otherPlayer();
  renderBoatButtons(currentPlayer);

  renderFleet(currentPlayer);
  
  if (supplyBoatArrivedAndOk(currentPlayer)) {
    let powerup = getRandomPowerup();
    managePowerup(currentPlayer, powerup);
    supplyBoatDelay[currentPlayer] = -1;
  }

  renderInventory(currentPlayer);
  renderPlayerColour(currentPlayer);
  renderGameStats(currentPlayer, "");
  document.querySelector(".overlay").style.display = "none";
  document.getElementById("cover1").classList.add("hidden");
  document.getElementById("cover2").classList.add("hidden");
}

/* =========================
   11. BOARD INTERACTIONS
========================= */

function createBoard(board, boardId) {
  let boardDiv = document.getElementById(boardId);

  for (let i = 0; i < BOARD_SIZE; ++i) {
    board[i] = [];
    for (let j = 0; j < BOARD_SIZE; ++j) {
      let cellDiv = document.createElement("div");
      cellDiv.classList.add("cell-style");

      board[i][j] = {
        x: i,
        y: j,
        placed: false,
        div: cellDiv,
        placedBoatId: 0,
        cellHit: false,
        isSupply: false,
        shieldState: 0,
        revealedByPing: false,
        boardId: boardId
      };

      cellDiv.cellData = board[i][j];
      boardDiv.appendChild(cellDiv);

      cellDiv.addEventListener("click", function() {
        if (!isValidMove(boardId)) {
          return;
        }

        if (gamePhase == "placement") {
          if (hoveredCell === null || currentBoatCells.length === 0) {
            return;
          }

          if (currentBoatSize != 0 && !hoveredCell.cellData.placed && player[currentPlayer].boatType[currentBoatType] != 0) {
            ++currentBoatId[currentPlayer];
            let currentId = currentBoatId[currentPlayer];
            let boatCells = [];

            for (let i = 0; i < currentBoatSize; ++i) {
              let x = currentBoatCells[i].x;
              let y = currentBoatCells[i].y;
              board[x][y].placed = true;
              board[x][y].placedBoatId = currentId;
              board[x][y].div.classList.remove("preview-boat");
              board[x][y].div.classList.add("placed-boat-player" + currentPlayer);
              boatCells.push({ x: x, y: y });

              for (let d = 0; d < 8; ++d) {
                let vx = x + dx[d];
                let vy = y + dy[d];
                if (vx <= 9 && vx >= 0 && vy <= 9 && vy >= 0) {
                  board[vx][vy].placed = true;
                }
              }
            }

            player[currentPlayer].placedBoats[currentId] = boatCells;
            player[currentPlayer].boatName[currentId] = BOAT_NAME_BY_TYPE[currentBoatType];
            --player[currentPlayer].boatType[currentBoatType];
            --player[currentPlayer].totalBoats;

            let newNumber = player[currentPlayer].boatType[currentBoatType];
            document.getElementById(currentBoatType).innerHTML = "x" + newNumber;
            if (newNumber === 0) {
              renderGameStats(currentPlayer, "");
              clearButton(currentBoatType);
              currentBoatSize = 0;
              currentBoatType = "";
            }
            if (player[currentPlayer].totalBoats == 0) {
              gamePhase = "supplyPlacement";
              renderGameStats(currentPlayer, "");
              renderGame();
            }

            renderFleet(currentPlayer);
          }
        } else if (gamePhase === "battle") {
          if (selectedPowerup !== "") {
            deselectButton(selectedPowerupId);
            clearPowerup(selectedPowerupId);
          }

          if (selectedPowerup === "shield") {
            for (let i = 0; i < currentBoatCells.length; ++i) {
              let x = currentBoatCells[i].x;
              let y = currentBoatCells[i].y;
              board[x][y].shieldState = 1;
            }
            resetPowerup();
            showOverlay();
          } else if (isSupplyBoat()) {
            if (supplyBoatReady() && !isSupplyBoatDestroyed(currentPlayer)) {
              startSupplyCountdown();
              showOverlay();
            }
          } else {
            if (selectedPowerup === "pingBullet") {
              revealBoat();
            } else if (whiteFlagActive === true) {
              let id = cellDiv.cellData.placedBoatId;
              if (id != 0) {
                currentBoatCells.length = 0;
                for (let i = 0; i < BOARD_SIZE; ++i) {
                  for (let j = 0; j < BOARD_SIZE; ++j) {
                    if (board[i][j].placedBoatId === id) {
                      currentBoatCells.push({ x: i, y: j });
                    }
                  }
                }
                if (whiteFlagActive === true) {
                  resetWhiteFlag();
                }
              }
            }

            for (let i = 0; i < currentBoatCells.length; ++i) {
              let x = currentBoatCells[i].x;
              let y = currentBoatCells[i].y;
              if (!board[x][y].cellHit) {
                if (board[x][y].shieldState === 0 || board[x][y].shieldState === 2) {
                  board[x][y].cellHit = true;
                }
                if (board[x][y].shieldState === 1) {
                  board[x][y].shieldState = 2;
                }
                if (board[x][y].placedBoatId !== 0) {
                  board[x][y].div.classList.remove("revealed");
                  board[x][y].div.classList.remove("preview-attack");
                  board[x][y].div.classList.remove("board-cover");
                  if (board[x][y].cellHit === true) {
                    board[x][y].div.classList.remove("broken-shield");
                    renderHitCell(board, x, y);
                  } else {
                    board[x][y].div.classList.remove("shield-cell");
                    board[x][y].div.classList.add("broken-shield");
                  }
                } else {
                  board[x][y].div.classList.remove("preview-attack");
                  board[x][y].div.classList.add("hit-cell");
                }
              }
            }

            showOverlay();
          }
        } else if (gamePhase === "supplyPlacement") {
          for (let i = 0; i < currentBoatCells.length; ++i) {
            let x = currentBoatCells[i].x;
            let y = currentBoatCells[i].y;
            board[x][y].isSupply = true;
            supplyBoatId[currentPlayer] = board[x][y].placedBoatId;
          }

          renderFleet(currentPlayer);
          if (currentPlayer === 1) {
            gamePhase = "placement";
            showOverlay();
          }
          if (currentPlayer === 2) {
            gamePhase = "battle";
            showOverlay();
          }
        }
      });

      cellDiv.addEventListener("mouseover", function() {
        hoveredCell = {
          x: cellDiv.cellData.x,
          y: cellDiv.cellData.y,
          board: board,
          cellData: cellDiv.cellData,
          div: cellDiv
        };
        if (gamePhase === "supplyPlacement") {
          renderGameStats(currentPlayer, "");
        }
        if (!isValidMove(boardId)) {
          return;
        }
        renderGame();
      });

      cellDiv.addEventListener("mouseout", function() {
        deletePreview();
      });
    }
  }
}

/* =========================
   12. EVENTS
========================= */

document.addEventListener("keydown", function(event) {
  if (gamePhase === "placement") {
    if (hoveredCell === null) {
      return;
    }
    if (event.key === "r" || event.key === "R") {
      if (orientation === "horizontal") {
        orientation = "vertical";
      } else {
        orientation = "horizontal";
      }
      let hoveredCellCopy = hoveredCell;
      deletePreview();
      hoveredCell = hoveredCellCopy;
      renderGame();
    }
  }
});

document.getElementById("player-form").addEventListener("submit", function(event) {
  event.preventDefault();
  player[1].name = document.getElementById("player1Name").value;
  player[2].name = document.getElementById("player2Name").value;
  gamePhase = "placement";
  startGame();
});

/* =========================
   13. INIT
========================= */

let menuButtons = document.querySelectorAll(".menu-button");
for (let i = 0; i < menuButtons.length; ++i) {
  menuButtons[i].classList.add("hidden");
}

openSidebar();
player[1] = createPlayer();
player[2] = createPlayer();
player[1].color = "rgb(105, 185, 212)";
player[2].color = "rgb(212, 105, 105)";
createBoard(player[1].board, "player1-board");
createBoard(player[2].board, "player2-board");
