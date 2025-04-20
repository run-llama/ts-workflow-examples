import { config } from 'dotenv';
config({ path: '.env.local' });

import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { pipeline } from "node:stream/promises";
import { Anthropic } from "@llamaindex/anthropic";
import {
    agent,
    tool,
    Settings,
    QueryEngineTool,
    VectorStoreIndex,
} from "llamaindex";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { SimpleDirectoryReader } from "@llamaindex/readers/directory";
import { z } from "zod";

////////// load data and create a RAG index, and create a query tool

Settings.llm = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: "claude-3-7-sonnet-latest",
});

Settings.embedModel = new HuggingFaceEmbedding({
    modelType: "BAAI/bge-small-en-v1.5",
    quantized: false,
});

const reader = new SimpleDirectoryReader();
const documents = await reader.loadData("./data");

const index = await VectorStoreIndex.fromDocuments(documents);

// You will want a persistent vector store! See https://ts.llamaindex.ai/docs/llamaindex/tutorials/agents/7_qdrant

const retriever = await index.asRetriever();

retriever.similarityTopK = 10;

const queryTool = index.queryTool({
    metadata: {
        name: "san_francisco_budget_tool",
        description: `This tool can answer detailed questions about the individual components of the budget of San Francisco in 2023-2024.`,
    },
    retriever: retriever,
})

////////// create the origina number-summing tool

const sumNumbers = ({ a, b }) => {
    return `${a + b}`;
};

const addTool = tool({
    name: "sumNumbers",
    description: "Use this function to sum two numbers",
    parameters: z.object({
        a: z.number({
            description: "First number to sum",
        }),
        b: z.number({
            description: "Second number to sum",
        }),
    }),
    execute: sumNumbers,
});

////////// create the agent with both tools

const tools = [addTool, queryTool];
const myAgent = agent({ tools });

////////// define a workflow (optional for such a simple example!)

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

// handle the start event
workflow.handle([startEvent], async (start) => {
    console.log(`Started the workflow with question: ${start.data}`);

    const response = await myAgent.run(start.data);
    return stopEvent.with(response.data.result);
});

////////// run the workflow

// Create a workflow context and send the initial event
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("What is the total budget of San Francisco in 2023-2024?"));

// Process the stream to get the result
const result = await pipeline(stream, async function (source) {
    for await (const event of source) {
        if (stopEvent.include(event)) {
            return `Result: ${event.data}`;
        }
    }
});

console.log(result)
