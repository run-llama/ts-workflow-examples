import { NextResponse } from 'next/server';
import { createWorkflow, workflowEvent, getContext, } from "@llama-flow/core";
import { withStore } from "@llama-flow/core/middleware/store";
import { pipeline } from "node:stream/promises";
import { Anthropic } from "@llamaindex/anthropic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: Connected to workflow\n\n'));

      // initialize the anthropic client
      const llm = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      ////////// define the workflow

      const startEvent = workflowEvent<{
        topic:string|null,
        research:string,
        feedback:string|null
      }>();
      const writeEvent = workflowEvent<string>();
      const reviewEvent = workflowEvent<string>();
      const stopEvent = workflowEvent<string>();

      const workflow = withStore(()=>({
        topic: null as string | null,
        research: "" as string,
        feedback: null as string | null
      }),createWorkflow());

      // handle the start event, which is either a new topic
      // or a loop with feedback for additional research
      workflow.handle([startEvent], async (start) => {
        console.log("Starting agent, topic is ", start.data.topic)

        // store the topic in case we need to loop
        workflow.getStore().topic = start.data.topic
        let prompt = `What do you know about the topic <topic>${start.data.topic}</topic>? Be very brief.`

        // if we've previously looped, include the feedback
        if (start.data.feedback) {
          console.log("Feedback is ", start.data.feedback)
          prompt += `\nYou have researched this topic before. The feedback you got to research it more is: <feedback>${start.data.feedback}</feedback>`
        }

        // get the research
        let result = await llm.complete({prompt:prompt})
        return writeEvent.with(result.text)
      });

      // with the research, store it and try writing a post
      workflow.handle([writeEvent], async (write) => {
        console.log(`Writing post, data is ${write.data}`)

        // store the research; this may not be the first time around
        workflow.getStore().research += `<research>${write.data}</research>`

        // try writing a post
        let result = await llm.complete({prompt:`We have done some research about a topic. Write a post about it. Use ONLY the research data provided, nothing from your training data, even if that results in a very short post. ${workflow.getStore().research}`})
        return reviewEvent.with(result.text)
      });

      // review the post and either stop or loop
      workflow.handle([reviewEvent], async (review) => {
        console.log("Reviewing post, data is ", review.data)

        // review the post
        let result = await llm.complete({prompt:`We have written a post about a topic. Review it for any errors or missing information. <post>${review.data}</post>. If it is good, return the string "good". If it requires more research, return some feedback on what to research next.`})

        // if the post is good, stop
        if (result.text === "good") {
          console.log("Post is good, stopping")
          return stopEvent.with(review.data)
        } else {
          // otherwise, loop with the feedback
          console.log("Post got feedback; looping")
          return startEvent.with({
            topic: workflow.getStore().topic,
            research: workflow.getStore().research,
            feedback: result.text
          })
        }
      });

      ////////// run the workflow

      // Create a workflow context and send the initial event
      const { stream, sendEvent } = workflow.createContext();
      sendEvent(startEvent.with({topic:"Unicorns",research:null,feedback:null}));

      // Process the stream to get the result
      pipeline(stream, async function (source) {
        for await (const event of source) {
          console.log("Got a new event", event.data)
          controller.enqueue(encoder.encode("data: " + JSON.stringify(event.data)+"\n\n"));  
          if (stopEvent.include(event)) {
            controller.close();
          }
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 
