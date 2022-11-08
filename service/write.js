require("dotenv").config();

const express = require("express"),
  { existsSync, mkdirSync, appendFileSync } = require("fs"),
  serverPorts = process.env.PORT ? process.env.PORT.split(/\D+/) : [8080],
  app = express(),
  Sequelize = require("sequelize"),
  { TINYINT, STRING, TEXT, JSON, DATE, Model } = Sequelize,
  newId = require("uid2"),
  { lookup } = require("geoip-lite"),
  dialect = process.env.DB_DIALECT || "mysql",
  dbConnectString = `${dialect}://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_DB}`,
  sequelize = new Sequelize(dbConnectString, {
    dialect,
    dialectOptions: {
      connectTimeout: (process.env.DB_CONNECT_TIMEOUT || 3) * 1000,
    },
    logging: !!process.env.DB_VERBOSE ? console.log : false,
  }),
  defaultSequelizeOptions = { sequelize, timestamps: false },
  fields = {
    id: { type: STRING, primaryKey: true },
    submittedAt: DATE,
    testName: TEXT,
    email: TEXT,
    age: TINYINT,
    sex: TEXT,
    ipData: JSON,
    data: JSON
  };

class Response extends Model { }
Response.init(fields, {
  ...defaultSequelizeOptions,
  tableName: "responses"
});

app.set("trust proxy", true); // trust user ip address passed through from nginx
app.use(
  express.json({ limit: '1mb' }),
  express.urlencoded({ extended: true, limit: '1mb' }),
);

app.post(`/service/write.js`, async (req, res) => {
  const { sessionJSON } = req.body,
    session = JSON.parse(sessionJSON),
    filepathPrefix = `../results/${encodeURIComponent(`${session.testId}`)}/`,
    filepathPostfix = `.csv`;

  if (!existsSync(filepathPrefix)) mkdirSync(filepathPrefix);
  const namesLength = session.participant.name.length;
  let writeMushra = false,
    mushraCsvData = [],
    recordData = { // for the database
      id: newId(16),
      submittedAt: new Date(),
      testName: null,
      email: null,
      age: null,
      sex: null,
      ipData: JSON.stringify(lookup(req.ip || "1.2.3.4"), null, 5),
      data: null
    },
    dataList = [];

  let input = ["session_test_id"];

  for (let i = 0; i < namesLength; ++i)
    input.push(session.participant.name[i]);

  input.push("session_uuid", "trial_id", "rating_stimulus", "rating_score", "rating_time", "rating_comment");
  mushraCsvData.push(input);

  dataList.push(input);

  for (const trial of session.trials) {
    if (trial.type !== "mushra") continue;
    writeMushra = true;

    for (const response of trial.responses) {
      let results = [session.testId];
      recordData["testName"] = session.testId;

      for (let i = 0; i < namesLength; ++i) {
        results.push(session.participant.response[i]);
        recordData[["email", "age", "sex"][i]] = session.participant.response[i];
      }

      results.push(session.uuid, trial.id, response.stimulus,
        response.score, response.time, response.comment);

      mushraCsvData.push(results);
      dataList.push(results);
    }
  }

  recordData["data"] = JSON.stringify(dataList, null, 5);
  await Response.create(recordData);

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
    }).filter(e => !!e).join("\n") + "\n";

  appendFileSync(filename, csvContent);
  return res.json({ ok: true, at: new Date(), filename });
});

for (let port of serverPorts) app.listen(port);
console.info(`API server running at`, new Date(),
  `on port${serverPorts.length === 1 ? "" : "s"}`, serverPorts.join(", "));
