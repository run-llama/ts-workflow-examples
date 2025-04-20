import { config } from 'dotenv';
config({ path: '.env.local' });

import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";
import { until } from "@llama-flow/core/stream/until";
import { collect } from "@llama-flow/core/stream/consumer";
import { filter } from "@llama-flow/core/stream/filter";
import { pipeline } from "node:stream/promises";
import { Anthropic } from "@llamaindex/anthropic";

////////// define the workflow

const startEvent = workflowEvent<string>();
const subquestionEvent = workflowEvent<string>();
const questionAnsweredEvent = workflowEvent<string>();
const synthesizeEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

// initialize the LLM
const llm = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// handle the start event
workflow.handle([startEvent], async (start) => {

  // take a complicated question and split it up
  let prompt = `We have been ask a complicated question: <question>${start.data}</question>.
    Split it up into a few different questions that are easier to answer.
    Return the questions with one question per line.
    Do not include any other text, preamble or explanation in your response.
  `
  let result = await llm.complete({prompt:prompt})

  // split up the result into an array of questions
  let questions = result.text.split("\n").map(q => q.trim()).filter(q => q !== "");
  console.log(`Questions: ${questions}`);

  // emit the questions
  const { sendEvent, stream } = getContext();
  for (let question of questions) {
    sendEvent(subquestionEvent.with(question));
  }

  // get all the answers to the questions
  let condition = 0;
  const results = await collect(
    until(
      filter(stream, (ev) => questionAnsweredEvent.include(ev)),
      () => {
        condition++;
        return condition === questions.length;
      },
    ),
  );

  // synthesize the answers into a final answer
  let answers = results.map(r => r.data)
  console.log(answers)
  return synthesizeEvent.with({
    answers: answers.join("\n"),
    question: start.data
  });
});

// handle each sub-question
workflow.handle([subquestionEvent], async (subquestion) => {
  console.log(`Answering sub-question: ${subquestion.data}`);
  
  let prompt = `Answer the question: <question>${subquestion.data}</question>.
    Return the answer as a short answer.
  `
  let result = await llm.complete({prompt:prompt})
  console.log(`Answer: ${result.text}`);
  return questionAnsweredEvent.with(result.text)
});

// handle the collected results
workflow.handle([synthesizeEvent], async (synthesize) => {

  let prompt = `You were given the complicated question ${synthesize.data.question}. 
    We split it into multiple simpler questions. 
    The answers to the questions are: <answers>${synthesize.data.answers}</answers>.`
  console.log(`Synthesizing answer: ${prompt}`);
  let result = await llm.complete({prompt:prompt})  
  return stopEvent.with(result.text);
});

////////// run the workflow

// Create a workflow context and send the initial event
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("How has US tariff policy changed over the lifetime of the United States? Go back as far as you can."));

// Process the stream to get the result
const result = await pipeline(stream, async function (source) {
  for await (const event of source) {
    if (stopEvent.include(event)) {
      return `Result: ${event.data}`;
    }
  }
});

console.log(result)
