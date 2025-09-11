const {
  HuggingFaceHubEmbeddings,
} = require("@langchain/community/embeddings/hf");
const { HuggingFaceInference } = require("@langchain/community/llms/hf");
const {
  MongoDBAtlasVectorSearch,
} = require("@langchain/community/vectorstores/mongodb_atlas");
const PersonalData = require("../models/PersonalData");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { RetrievalQAChain, LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("@langchain/core/prompts");

// Global instances (avoid recreating per request)
const embeddings = new HuggingFaceHubEmbeddings({
  repoId: "sentence-transformers/all-MiniLM-L6-v2",
  apiKey: process.env.HF_TOKEN,
  provider: "hf-inference", // Explicit provider to avoid selection errors
});

const llm = new HuggingFaceInference({
  model: "microsoft/DialoGPT-medium", // Lighter, reliable open-source model (change back to Mistral if token works)
  apiKey: process.env.HF_TOKEN,
  temperature: 0.7,
  maxTokens: 300,
});

exports.addPersonalData = async (req, res) => {
  try {
    const { category, content } = req.body;
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const docs = await splitter.createDocuments([content]);
    const vectors = await embeddings.embedDocuments(
      docs.map((d) => d.pageContent)
    );
    const data = new PersonalData({ category, content, vector: vectors[0] });
    await data.save();
    res.json({ message: "Data added" });
  } catch (error) {
    console.error("Add data error:", error);
    res.status(500).json({ error: "Failed to add data" });
  }
};

exports.chat = async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query required" });

  try {
    console.log("Initializing vector store...");
    const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection: PersonalData.collection,
      indexName: "vector_index",
      textKey: "content",
      embeddingKey: "vector",
    });

    const retriever = vectorStore.asRetriever({ k: 3 });
    const ragChain = RetrievalQAChain.fromLLM(llm, retriever, {
      returnSourceDocuments: true,
    });

    let response;
    const ragResult = await ragChain.call({ query });
    if (ragResult.sourceDocuments && ragResult.sourceDocuments.length > 0) {
      response = ragResult.text;
      console.log(
        `RAG success: Found ${ragResult.sourceDocuments.length} docs`
      );
    } else {
      console.log("No RAG docs; falling back to general LLM");
      const generalPrompt = new PromptTemplate({
        inputVariables: ["query"],
        template: "You are a helpful AI assistant. Answer: {query}",
      });
      const generalChain = new LLMChain({ llm, prompt: generalPrompt });
      const generalResult = await generalChain.call({ query });
      response = generalResult.text;
    }
    res.json({ reply: response });
  } catch (error) {
    console.error("Chat error:", error.message || error);
    res.status(500).json({ error: "Internal server error. Check logs." });
  }
};
