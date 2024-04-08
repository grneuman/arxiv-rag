import bodyParser from "body-parser";
import express from "express";
import { takeNotes } from "notes/index.js";
import { qaOnPaper } from "qa/index.js";

function processPagesToDelete(pagesToDelete: string): Array<number> {
  const numArr = pagesToDelete.split(",").map((num) => parseInt(num.trim()));
  return numArr;
}

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
    console.log(req.body);
    const { paperUrl, name, pagesToDelete } = req.body;
    console.log({ paperUrl, name, pagesToDelete });
    // convert pagesToDelete back to array of numebrs
    const pagesToDeleteArray = pagesToDelete
      ? processPagesToDelete(pagesToDelete)
      : undefined;
    console.log(pagesToDeleteArray);
    const notes = await takeNotes(paperUrl, name, pagesToDeleteArray);
    res.status(200).send(notes);
    return;
  });

  app.post("/qa", async (req, res) => {
    console.log(req.body);
    const { paperUrl, question } = req.body;
    console.log("paperUrl in /qa", paperUrl);
    console.log("question in /qa", question);
    const qa = await qaOnPaper(question, paperUrl);
    res.status(200).send(qa);
    return;
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

main();
