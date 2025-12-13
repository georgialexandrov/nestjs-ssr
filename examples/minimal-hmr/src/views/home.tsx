import type { PageProps } from '@nestjs-ssr/react';
import { useState } from 'react';

interface HomeProps {
  message: string;
  timestamp: string;
}

export default function Home(props: PageProps<HomeProps>) {
  const { message, timestamp } = props;
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>NestJS SSR with React - HMR Test</h1>
      <p>{message}</p>
      <p>Server time: {timestamp}</p>
      <button onClick={() => setCount(count - 1)}>-</button>
      Counts: {count}
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
