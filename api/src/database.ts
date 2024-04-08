import { SupabaseClient, createClient } from "@supabase/supabase-js";
import {
  ARXIV_EMBEDDINGS_TABLE,
  ARXIV_PAPERS_TABLE,
  ARXIV_QA_TABLE,
  Database,
} from "generated/db.js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { Document } from "langchain/document";
import { ArxivPaperNote } from "notes/prompts.js";

export class SupabaseDatabase {
  vectorStore: SupabaseVectorStore;
  client: SupabaseClient<Database, "public", any>;

  constructor(
    client: SupabaseClient<Database, "public", any>,
    vectorStore: SupabaseVectorStore
  ) {
    this.client = client;
    this.vectorStore = vectorStore;
  }

  static async fromExistingIndex(): Promise<SupabaseDatabase> {
    const privateKey = process.env.SUPABASE_ACCESS_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!privateKey || !supabaseUrl) {
      throw new Error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_URL");
    }

    const supabase = createClient<Database>(supabaseUrl, privateKey);
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      {
        client: supabase,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(supabase, vectorStore);
  }

  static async fromDocuments(
    documents: Array<Document>
  ): Promise<SupabaseDatabase> {
    const privateKey = process.env.SUPABASE_ACCESS_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!privateKey || !supabaseUrl) {
      throw new Error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_URL");
    }

    const supabase = createClient<Database>(supabaseUrl, privateKey);
    const vectorStore = await SupabaseVectorStore.fromDocuments(
      documents,
      new OpenAIEmbeddings(),
      {
        client: supabase,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(supabase, vectorStore);
  }

  async addPaper({
    paper,
    url,
    notes,
    name,
  }: {
    paper: string;
    url: string;
    notes: Array<ArxivPaperNote>;
    name: string;
  }) {
    const { data, error } = await this.client
      .from(ARXIV_PAPERS_TABLE)
      .insert({
        arxiv_url: url,
        name,
        paper,
        notes,
      })
      .select();
    if (error) {
      throw new Error(
        "Error adding paper to database" + JSON.stringify(error, null, 2)
      );
    }
    console.log(data);
  }

  async getPaper(
    url: String
  ): Promise<Database["public"]["Tables"]["arxiv_papers"]["Row"] | null> {
    console.log("url", url);
    const { data, error } = await this.client
      .from(ARXIV_PAPERS_TABLE)
      .select()
      .eq("arxiv_url", url);

    if (error || !data) {
      console.log("Error getting paper from database");
      return null;
    }

    return data[0];
  }

  async saveQa(
    question: string,
    answer: string,
    context: string,
    followupQuestions: string[]
  ) {
    console.log("saving qa", question, answer, context, followupQuestions);
    const { error } = await this.client.from(ARXIV_QA_TABLE).insert({
      question,
      answer,
      context,
      followup_questions: followupQuestions,
    });

    if (error) {
      console.log("Error saving QA to database");
      throw error;
    }
  }
}
