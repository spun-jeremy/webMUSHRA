require("dotenv").config();

const express = require("express"),
  { existsSync, mkdirSync, appendFileSync } = require("fs"),
  serverPorts = process.env.PORT ? process.env.PORT.split(/\D+/) : [8080],
  app = express();

app.set("trust proxy", true); // allow ip information to be passed through
app.use(
  express.json({ limit: '1gb' }),
  express.urlencoded({ extended: true, limit: '1gb' }),
);

app.post(`/service/write.js`, async (req, res) => {
  const { sessionJSON } = req.body,
    session = JSON.parse(sessionJSON),
    filepathPrefix = `../results/${""}/`,
    filepathPostfix = `.csv`;

  if (!existsSync(filepathPrefix)) mkdirSync(filepathPrefix);
  const namesLength = session.participant.name.length;
  let writeMushra = false,
    mushraCsvData = [];

  let input = ["session_test_id"];

  for (let i = 0; i < namesLength; ++i)
    input.push(session.participant.name[i]);

  input.push("session_uuid", "trial_id", "rating_stimulus", "rating_score", "rating_time", "rating_comment");
  mushraCsvData.push(input);

  for (const trial of session.trials) {
    if (trial.type !== "mushra") continue;
    writeMushra = true;

    for (const response of trial.responses) {
      let results = [session.testId];
      for (let i = 0; i < namesLength; ++i)
        results.push(session.participant.response[i]);

      results.push(session.uuid, trial.id, response.stimulus,
        response.score, response.time, response.comment);

      mushraCsvData.push(results);
    }
  }
  if (!writeMushra) {
    const error = `Unsupported, non-mushra test type`;
    console.error(error);
    return res.json({ ok: false, at: new Date(), error });
  }
  const filename = `${filepathPrefix}mushra${filepathPostfix}`,
    fileExists = existsSync(filename),
    csvContent = mushraCsvData.map((line, idx) => {
      if (idx === 0 && fileExists) return null;
      return line
        .map(l => `${l}`.indexOf(",") > -1 ? `"${l}"` : l)
        .join(",");
    }).filter(e => !!e).join("\n");

  appendFileSync(filename, csvContent);
  return res.json({ ok: true, at: new Date(), filename });
});

for (let port of serverPorts) app.listen(port);
console.info(`API server running at`, new Date(),
  `on port${serverPorts.length === 1 ? "" : "s"}`, serverPorts.join(", "));
