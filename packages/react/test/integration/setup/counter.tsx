import { useState } from 'react';
import type { PageProps } from '@nestjs-ssr/react';

export interface CounterProps {
  message: string;
}

export default function Counter(props: PageProps<CounterProps>) {
  const { message } = props;
  const [count, setCount] = useState(0);

  return (
    <div data-testid="counter-app">
      <h1 data-testid="message">{message}</h1>
      <div data-testid="count">{count}</div>
      <button data-testid="increment" onClick={() => setCount((c) => c + 1)}>
        +
      </button>
      <button data-testid="decrement" onClick={() => setCount((c) => c - 1)}>
        -
      </button>
    </div>
  );
}
