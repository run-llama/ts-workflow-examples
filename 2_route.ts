import { createWorkflow, workflowEvent } from "@llama-flow/core";
import { pipeline } from "node:stream/promises";

////////// define the workflow

const startEvent = workflowEvent<string>();
const branchA1Event = workflowEvent<string>();
const branchA2Event = workflowEvent<string>();
const branchB1Event = workflowEvent<string>();
const branchB2Event = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

// handle the start event
workflow.handle([startEvent], (start) => {
  // Randomly choose between branch A and B
  if (Math.random() < 0.5) {
    return branchA1Event.with("Chose branch A");
  } else {
    return branchB1Event.with("Chose branch B");
  }
});

// handle branch A
workflow.handle([branchA1Event], (branchA1) => {
  return branchA2Event.with(branchA1.data);
});

workflow.handle([branchA2Event], (branchA2) => {
  return stopEvent.with(branchA2.data);
});

// handle branch B
workflow.handle([branchB1Event], (branchB1) => {
  return branchB2Event.with(branchB1.data);
});

workflow.handle([branchB2Event], (branchB2) => {
  return stopEvent.with(branchB2.data);
});

////////// run the workflow

// Create a workflow context and send the initial event
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("I am some data"));

// Process the stream to get the result
const result = await pipeline(stream, async function (source) {
  for await (const event of source) {
    console.log(`Event: ${event.data}`);
    if (stopEvent.include(event)) {
      return `Result: ${event.data}`;
    }
  }
});

console.log(result)
