'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/run-workflow');

    eventSource.onmessage = (event) => {
      console.log("Got a new event", event.data)
      setEvents(prev => [...prev, event.data]);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="page-container">
      <h1 className="page-heading">Workflow Events</h1>
      <ul className="events-list">
        {events.map((event, index) => (
          <li key={index} className="event-item">
            {event}
          </li>
        ))}
      </ul>
    </div>
  );
}
