const jwtUtils = require("jsonwebtoken");

function intercept(req, res, next) {
  const token = req.headers.authorization;

  try {
    if (!token || !jwtUtils.verify(token, "azerty123")) {
      console.log("token: " + token);
      console.log("value: " + jwtUtils.verify(token, "azerty123"));

      return res.sendStatus(401);
    }

    const jwtParts = token.split(".");
    const body = JSON.parse(atob(jwtParts[1]));

    req.user = body;
  } catch (e) {
    console.log("Format invalide");
    console.log(e);

    return res.sendStatus(401);
  }

  next();
}

module.exports = intercept;
