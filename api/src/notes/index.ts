import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { Document } from "langchain/document";
import { writeFile, unlink, readFile } from "fs/promises";
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured";
import { formatDocumentsAsString } from "langchain/util/document";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ArxivPaperNote,
  NOTES_TOOL_SCHEMA,
  NOTE_PROMPT,
  outputParser,
} from "notes/prompts.js";
import { SupabaseDatabase } from "database.js";

async function deletePages(
  pdf: Buffer,
  pagesToDelete: number[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdf);
  let numToOffsetBy = 1;
  for (const pageNum of pagesToDelete) {
    pdfDoc.removePage(pageNum - numToOffsetBy);
    numToOffsetBy++;
  }
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function loadPdfFromUrl(url: string): Promise<Buffer> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return response.data;
}

async function convertPdfToDocuments(pdf: Buffer): Promise<Array<Document>> {
  console.log("api key", process.env);
  if (!process.env.UNSTRUCTURED_API_KEY) {
    throw new Error("Missing UNSTRUCTURED_API_KEY API Key");
  }
  const randomName = Math.random().toString(36).substring(7); // use random name to avoid file conflicts
  const pdfPath = `pdfs/${randomName}.pdf`;
  await writeFile(`pdfs/${randomName}.pdf`, pdf, "binary");
  const loader = new UnstructuredLoader(pdfPath, {
    apiKey: process.env.UNSTRUCTURED_API_KEY,
    apiUrl: process.env.UNSTRUCTURED_API_URL,
    strategy: "hi_res",
  });

  const documents = await loader.load();
  //await unlink(`pdfs/${randomName}.pdf`); // delete the file after we're done
  return documents;
}

async function generateNote(
  documents: Array<Document>
): Promise<Array<ArxivPaperNote>> {
  const documentsAsString = formatDocumentsAsString(documents);
  const model = new ChatOpenAI({
    modelName: "gpt-4-1106-preview",
    temperature: 0.0,
  });
  const modelWithTools = model.bind({
    tools: [NOTES_TOOL_SCHEMA],
    tool_choice: "auto",
  });
  console.log("documentsAsString");
  console.log(documentsAsString);
  const chain = NOTE_PROMPT.pipe(modelWithTools).pipe(outputParser);
  const response = await chain.invoke({
    paper: documentsAsString,
  });
  console.log("response: " + response);
  return response;
}

export async function takeNotes(
  paperUrl: string,
  name: string,
  pagesToDelete?: number[]
): Promise<ArxivPaperNote[]> {
  const database = await SupabaseDatabase.fromExistingIndex();
  const existingPaper = await database.getPaper(paperUrl);
  if (existingPaper) {
    return existingPaper.notes as Array<ArxivPaperNote>;
  }
  if (!paperUrl.endsWith("pdf")) {
    throw new Error("Invalid file format: Not a pdf");
  }

  let pdfAsBuffer = await loadPdfFromUrl(paperUrl);

  if (pagesToDelete && pagesToDelete.length > 0) {
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }
  const documents = await convertPdfToDocuments(pdfAsBuffer);
  console.log(documents);

  //const docs = await readFile(`pdfs/documents.json`, "utf-8");
  //const parsedDocs: Array<Document> = JSON.parse(docs);
  const notes = await generateNote(documents);
  // const notes = await generateNote(parsedDocs);

  const newDocs: Array<Document> = documents.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      url: paperUrl,
    },
  }));
  console.log(notes);
  console.log("length", notes.length);
  console.log("after notes");

  console.log("table created");
  await Promise.all([
    database.addPaper({
      paper: formatDocumentsAsString(newDocs),
      url: paperUrl,
      notes,
      name,
    }),
    database.vectorStore.addDocuments(newDocs),
  ]);
  console.log("notes saved");
  return notes;
}

//takeNotes({ paperUrl: "https://arxiv.org/pdf/2305.15334.pdf", name: "test" });
