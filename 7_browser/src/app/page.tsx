"use client";

import { useEffect, useState } from 'react';
import { createWorkflow, workflowEvent, getContext } from "@llama-flow/core";

export default function Home() {

  const [updates, setUpdates] = useState([]);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Set up workflow
    const startEvent = workflowEvent<void>();
    const updateEvent = workflowEvent<string>();
    const completeEvent = workflowEvent<void>();

    const workflow = createWorkflow();

    workflow.handle([startEvent], () => {
      const { sendEvent } = getContext();

      // Simulate async updates
      const intervals = [
        setTimeout(() => sendEvent(updateEvent.with("First update")), 500),
        setTimeout(() => sendEvent(updateEvent.with("Second update")), 1000),
        setTimeout(() => sendEvent(updateEvent.with("Final update")), 1500),
        setTimeout(() => sendEvent(completeEvent.with()), 2000)
      ];

      // Cleanup function
      getContext().signal.onabort = () => {
        intervals.forEach(clearTimeout);
      };
    });

    // Run the workflow
    const { stream, sendEvent } = workflow.createContext();
    sendEvent(startEvent.with());

    // Process events
    const processEvents = async () => {
      for await (const event of stream) {
        if (updateEvent.include(event)) {
          setUpdates(prev => [...prev, event.data]);
        } else if (completeEvent.include(event)) {
          setIsComplete(true);
          break;
        }
      }
    };

    processEvents();

    // Cleanup
    return () => {
      // The workflow will be aborted when the component unmounts
    };
  }, []);

  return (
    <div>
      <h2>Streaming Updates</h2>
      <ul>
        {updates.map((update, i) => (
          <li key={i}>{update}</li>
        ))}
      </ul>
      {isComplete && <div>Process complete!</div>}
    </div>
  );
}
