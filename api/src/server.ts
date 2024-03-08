import bodyParser from "body-parser";
import express from "express";
import { takeNotes } from "notes/index.js";
import { qaOnPaper } from "qa/index.js";

function main() {
  const app = express();
  const port = process.env.PORT || 9000;

  // For parsing application/json
  app.use(express.json());

  // For parsing application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (_req, res) => {
    // health check
    res.status(200).send("ok");
  });

  app.post("/take_notes", async (req, res) => {
    //console.log(req);
    console.log(req.body);
    // const json = JSON.parse(req.body);
    // console.log(json);
    const { paperUrl, name, pagesToDelete } = req.body;
    const notes = await takeNotes({ paperUrl, name, pagesToDelete });
    res.status(200).send(notes);
    return;
  });

  app.post("/qa", async (req, res) => {
    //console.log(req);
    console.log(req.body);
    // const json = JSON.parse(req.body);
    // console.log(json);
    const { paperUrl, question } = req.body;
    const qa = await qaOnPaper(paperUrl, question);
    res.status(200).send(qa);
    return;
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

main();
