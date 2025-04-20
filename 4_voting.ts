import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { until } from "@llama-flow/core/stream/until";
import { collect } from "@llama-flow/core/stream/consumer";
import { filter } from "@llama-flow/core/stream/filter";
import { pipeline } from "node:stream/promises";

////////// define the workflow

const startEvent = workflowEvent<string>();
const workEvent = workflowEvent<string>();
const workCompleteEvent = workflowEvent<string>();
const allCompleteEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

// handle the start event
workflow.handle([startEvent], async (start) => {
  // emit 10 identical events
  const { sendEvent, stream } = getContext();
  const totalEvents = 10
  for (let i = 0; i < totalEvents; i++) {
    sendEvent(workEvent.with(`Event ${i}`));
  }

  let completedEvents = 0;
  const results = await collect(
    until(
      filter(stream, (ev) => workCompleteEvent.include(ev)),
      () => {
        completedEvents++;
        return completedEvents === totalEvents;
      },
    ),
  );

  // return results of work
  return allCompleteEvent.with(results);
});

// handle the work event
workflow.handle([workEvent], (work) => {
  if (Math.random() < 0.5) {
    return workCompleteEvent.with(true);
  } else {
    return workCompleteEvent.with(false);
  }
});

// handle the collected results
workflow.handle([allCompleteEvent], (allComplete) => {

  // count votes
  const trueCount = allComplete.data.filter(r => r.data === true).length;
  const falseCount = allComplete.data.filter(r => r.data === false).length;
  const majorityResult = trueCount > falseCount;
  console.log(`Vote result: ${majorityResult} (${trueCount} true vs ${falseCount} false)`); ``

  return stopEvent.with(majorityResult);
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
