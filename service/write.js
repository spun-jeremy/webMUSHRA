require("dotenv").config();

const express = require("express"),
  serverPorts = process.env.PORT ? process.env.PORT.split(/\D+/) : [8080],
  app = express();

app.set("trust proxy", true); // allow ip information to be passed through
app.use(
  express.json({ limit: '1gb' }),
  express.urlencoded({ extended: true, limit: '1gb' }),
);

app.post(`/service/save.js`, async (req, res) => {
  return res.json({ok: true, at: new Date()})  ;
});

for (let port of serverPorts) app.listen(port);
console.info(`API server running at`, new Date(),
  `on port${serverPorts.length === 1 ? "" : "s"}`, serverPorts.join(", "));
