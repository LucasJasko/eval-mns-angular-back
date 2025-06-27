const express = require("express");
const sql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const connexion = sql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "eval-angular",
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
  connexion.query("INSERT INTO user (email, password, role_id) VALUES (?, ?, 1)", [user.email, passwordHash], (err, line) => {
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
    SELECT u.id, u.email, u.password, r.name
    FROM user u 
    JOIN role r ON u.role_id = r.id 
    WHERE email = ?
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
            role: lines[0].name,
            id: lines[0].id,
          },
          "maSignature999"
        )
      );
    }
  );
});

app.listen(8080, () => {
  console.log("Le serveur écoute sur le port", 8080);
});
