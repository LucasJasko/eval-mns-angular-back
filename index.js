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
