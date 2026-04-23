const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database(
  path.join(__dirname, "game.db"),
  (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log("Baza de date conectată.");
    }
  }
);

db.run(`
  CREATE TABLE IF NOT EXISTS saved_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    game_state TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

app.post("/save-game", (req, res) => {
  const gameState =  req.body;
  let player1 = gameState.player[1].name;
  let player2 = gameState.player[2].name;
  db.run(
    `INSERT INTO saved_games (name, game_state, created_at) VALUES (?, ?, ?)`,
    [
      player1 + "_vs_" + player2,
      JSON.stringify(gameState),
      new Date().toISOString()
    ],
    function (err) {
      if (err) {
        console.error("Eroare la insert:", err.message);
        return res.status(500).json({ error: "Nu s-a putut salva jocul." });
      }
      db.get(`SELECT COUNT(*) AS total FROM saved_games`, (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Eroare."});
        }
        if (rows.total <= 16) {
          console.log(rows.total);
          res.json({
            message: "Joc salvat cu succes.",
            id: this.lastID
          });
        } else {
          db.get(
            `SELECT id
             FROM saved_games
             ORDER BY datetime(created_at) ASC
             LIMIT 1`,
            (err, row) => {
              if (err) {
                return res.status(500).json({ error: "Eroare."});
              }
              db.run(
                `DELETE FROM saved_games WHERE id = ?`,
                [row.id],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: "Eroare la stergerea salvarii vechi."});
                  }
                  res.json({
                    message: "Joc salvat cu succes. Cea mai veche salvare a fost stearsa.",
                    id: this.lastID
                  });
                }
              );
            }
          );
        }
      });
    }
  );
  
});

app.get("/saved-games", (req, res) => {
  db.all(`SELECT id, name, created_at FROM saved_games`, (err, rows) => {
    if (err) {
      console.error("Eroare la obtinerea listei de salvari.", err.message);
      return res.status(500).json({ error: "Nu s-a putut obtine lista de salvari." });
    }
    res.json(rows);
  });
});

app.get("/load-game/:id", (req, res) => {
  const id = req.params.id;
  db.get(`SELECT game_state FROM saved_games WHERE id = ?`,
    [id],
    (err, save) => {
      if (err) {
        console.error("Eroare la obtinerea salvarii.", err.message);
        return res.status(500).json({ error: "Nu s-a putut obtine salvarea." });
      }
      if (!save) {
        return res.status(404).json({ error: "Aceasta salvare nu exista" });
      }
      const parsedSave = JSON.parse(save.game_state);
      res.json(parsedSave);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server pornit: http://localhost:${PORT}/main.html`);
});