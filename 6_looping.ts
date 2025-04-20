import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { pipeline } from "node:stream/promises";

////////// define the workflow

const startEvent = workflowEvent<string>();
const stepAEvent = workflowEvent<string>();
const stepBEvent = workflowEvent<string>();
const stepCEvent = workflowEvent<string>();
const loopEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

// handle the start event
workflow.handle([startEvent], async (start) => {
  console.log("Starting workflow, data is ", start.data)
  start.data.counter++
  return stepAEvent.with(start.data);
});

workflow.handle([stepAEvent], async (stepA) => {
  console.log("Step A, data is ", stepA.data)
  stepA.data.counter++
  return stepBEvent.with(stepA.data);
});

workflow.handle([stepBEvent], async (stepB) => {
  console.log("Step B, data is ", stepB.data)
  stepB.data.counter++
  return stepCEvent.with(stepB.data);
});

workflow.handle([stepCEvent], async (stepC) => {
  console.log("Step C, data is ", stepC.data)
  if (stepC.data.counter < 10) {
    console.log("Need to loop")
    return stepAEvent.with(stepC.data);
  } else {
    return stopEvent.with(stepC.data);
  }
});

////////// run the workflow

// Create a workflow context and send the initial event
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with({ counter: 0 }));

// Process the stream to get the result
const result = await pipeline(stream, async function (source) {
  for await (const event of source) {
    console.log("Got a new event", event.data)
    if (stopEvent.include(event)) {
      return `Result: ${event.data.counter}`;
    }
  }
});

console.log(result)
