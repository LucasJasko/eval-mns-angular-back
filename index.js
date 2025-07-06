const express = require("express");
const sql = require("mysql2");
const bcrypt = require("bcrypt");
const jwtUtils = require("jsonwebtoken");
const cors = require("cors");
const interceptor = require("./middleware/jwt-interceptor");

const app = express();

app.use(cors());
app.use(express.json());

const connexion = sql.createConnection({
  host: "localhost",
  user: "root",
  database: "eval-angular",
  password: "",
});

connexion.connect((err) => {
  if (err) {
    console.error("Erreur de conexion à la base de données :", err);
    return;
  }
  console.log("Connecté à la base de données SQL");
});

app.post("/signin", (req, res) => {
  const user = req.body;
  const passwordHash = bcrypt.hashSync(user.password, 10);
  connexion.query("INSERT INTO user (mail, password, role, pseudo) VALUES (?, ?, 3, ?)", [user.email, passwordHash, user.pseudo], (err, line) => {
    if (err && err.code == "ER_DUP_ENTRY") {
      return res.sendStatus(409); // Conflit
    }

    if (err) {
      return res.sendStatus(500);
    }

    user.id = res.insertId;
    res.json(user);
  });
});

app.post("/login", (req, res) => {
  connexion.query(
    `
    SELECT u.id, u.mail, u.password, u.pseudo, r.role_name
    FROM user u 
    JOIN role r ON u.role = r.role_id 
    WHERE mail = ?
    `,
    [req.body.email],
    (err, lines) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }

      if (lines.length === 0) return res.sendStatus(401);

      const formPassword = req.body.password;
      const fetchPassword = lines[0].password;
      const compatible = bcrypt.compareSync(formPassword, fetchPassword);

      if (!compatible) return res.sendStatus(401);

      return res.send(
        jwtUtils.sign(
          {
            sub: req.body.email,
            role: lines[0].role_name,
            pseudo: lines[0].pseudo,
            id: lines[0].id,
          },
          "maSignature999"
        )
      );
    }
  );
});

app.get("/room/list", (req, response) => {
  connexion.query("SELECT * FROM room", (err, item) => {
    if (err) {
      console.error(err);
      return res.send(500);
    }
    return response.json(item);
  });
});

app.get("/room/:id", interceptor, (req, res) => {
  connexion.query("SELECT * FROM room WHERE room_id = ?", [req.params.id], (err, lines) => {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }

    if (lines.length == 0) return res.sendStatus(404);

    return res.json(lines[0]);
  });
});

app.put("/room/:id", interceptor, (req, res) => {
  const room = req.body;
  room.id = req.params.id;

  if (req.user.role != "modo" && req.user.role != "admin") return res.sendStatus(403);
  if (room.name == null || room.name == "" || room.name.length > 20 || room.description.length > 50) return res.sendStatus(400);

  connexion.query("SELECT * FROM room WHERE room_name = ? AND room_id != ?", [room.name, room.id], (err, lines) => {
    if (lines.length > 0) return res.sendStatus(409);

    connexion.query("UPDATE room SET room_name = ?, room_desc = ? WHERE room_id = ?", [room.name, room.description, room.id], (err, line) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      return res.status(200).json(room);
    });
  });
});

app.post("/room", interceptor, (req, res) => {
  const room = req.body;

  if (req.user.role != "modo" && req.user.role != "admin") return res.sendStatus(403);

  if (room.name == null || room.nom == "" || room.name.length > 20 || room.description.length > 50) return res.sendStatus(400);

  connexion.query("SELECT * FROM room WHERE room_name = ?", [room.name], (err, line) => {
    if (line.length > 0) return res.sendStatus(409);

    const date = new Date().toISOString().slice(0, 19).replace("T", " ");

    connexion.query(
      "INSERT INTO room (room_name, room_desc, room_creator, room_creation_time) VALUES (?, ?, ?, '" + date + "')",
      [room.name, room.description, req.user.id],
      (err, line) => {
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        res.status(201).json(room);
      }
    );
  });
});

app.delete("/room/:id", interceptor, (req, res) => {
  connexion.query("SELECT * FROM room WHERE room_id = ?", [req.params.id], (err, lines) => {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }

    if (lines.length == 0) return res.sendStatus(404);

    const isOwner = req.user.role == "modo" && req.user.id == lines[0].id_creator;

    if (!isOwner && req.user.role != "admin") return res.sendStatus(403);

    connexion.query("DELETE FROM room WHERE room_id = ?", [req.params.id], (err, lines) => {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }

      return res.sendStatus(204);
    });
  });
});

app.post("/join", interceptor, (req, res) => {
  const room = req.body;

  if (room.room_id <= 0) return res.sendStatus(400);

  connexion.query("SELECT * FROM user_room WHERE user_id = ? AND room_id = ?", [room.room_id, req.user.id], (err, line) => {
    if (line.length > 0) return res.sendStatus(409);

    connexion.query("INSERT INTO user_room (user_id, room_id) VALUES (?, ?)", [req.user.id, room.room_id], (err, line) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      res.status(201).json(room);
    });
  });
});

app.post("/leave", interceptor, (req, res) => {
  const room = req.body;

  if (room.room_id <= 0) return res.sendStatus(400);

  connexion.query("DELETE FROM user_room WHERE user_id = ? AND room_id = ?", [req.user.id, room.room_id], (err, line) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }
    res.status(201).json(room);
  });
});

app.get("/messages/:id", interceptor, (req, res) => {
  connexion.query("SELECT * FROM message WHERE room_id = ?", [req.params.id], (err, messages) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }
    res.status(201).json(messages);
  });
});

app.post("/message", interceptor, (req, res) => {
  const request = req.body;

  if (request.room_id <= 0) return res.sendStatus(400);

  connexion.query(
    "INSERT INTO message (message_content, room_id, message_author) VALUES (?, ?, ?)",
    [request.message.content, request.room_id, request.message_author],
    (err, line) => {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      res.status(201).json(line);
    }
  );
});

app.put("/message", interceptor, (req, res) => {
  const request = req.body;

  if (request.room_id <= 0) return res.sendStatus(400);

  connexion.query("UPDATE message SET message_content = ? WHERE message_id = ?", [request.message.content, request.message_id], (err, line) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }
    res.status(201).json(line);
  });
});

app.delete("/message", interceptor, (req, res) => {
  const request = req.body;

  if (request.room_id <= 0) return res.sendStatus(400);

  connexion.query("DELETE FROM message WHERE message_id = ?", [request.message_id], (err, line) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }
    res.status(201).json(line);
  });
});

app.get("/user-room/list/:id", interceptor, (req, res) => {
  connexion.query("SELECT room_id FROM user_room WHERE user_id = ?", [req.params.id], (err, line) => {
    if (err) {
      console.log(err);
      return res.sendStatus(500);
    }

    if (line.length === 0) return res.status(201).json([]);

    let list = [];
    let sql = "SELECT * FROM room WHERE ";
    for (let i = 0; i < line.length; i++) {
      sql += "room_id = ?";
      list[i] = line[i].room_id;
      if (i < line.length - 1) {
        sql += " OR ";
      }
    }

    connexion.query(sql, list, (error, response) => {
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      res.status(201).json(response);
    });
  });
});

app.listen(8080, () => {
  console.log("Le serveur écoute sur le port", 8080);
});
