import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { pipeline } from "node:stream/promises";

////////// define the workflow

const startEvent = workflowEvent<string>();
const secondEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

// handle the start event
workflow.handle([startEvent], (start) => {
    console.log(`Started the workflow with input: ${start.data}`);
    return secondEvent.with(start.data);
});

// handle the second event
workflow.handle([secondEvent], (second) => {
    console.log(`Second event with input: ${second.data}`);
    return stopEvent.with(second.data);
});


////////// run the workflow

// Create a workflow context and send the initial event
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("I am some data"));

// Process the stream to get the result
const result = await pipeline(stream, async function (source) {
    for await (const event of source) {
        console.log(`Event: ${event} ${event.data}`);
        if (stopEvent.include(event)) {
            return `Result: ${event.data}`;
        }
    }
});

console.log(result)
