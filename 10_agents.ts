import { config } from 'dotenv';
config({ path: '.env.local' });

import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { pipeline } from "node:stream/promises";
import { Anthropic } from "@llamaindex/anthropic";
import {
    agent,
    AgentStream,
    tool,
    Settings,
} from "llamaindex";
import { z } from "zod";

////////// create the agent

Settings.llm = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: "claude-3-7-sonnet-latest",
});

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

const tools = [addTool];

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
sendEvent(startEvent.with("What is the sum of 2 and 8?"));

// Process the stream to get the result
const result = await pipeline(stream, async function (source) {
    for await (const event of source) {
        if (stopEvent.include(event)) {
            return `Result: ${event.data}`;
        }
    }
});

console.log(result)
