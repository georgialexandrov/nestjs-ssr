import React from 'react';

interface AppProps {
  children: React.ReactNode;
}

export default function App({ children }: AppProps) {
  return (
    <div id="app">
      {children}
    </div>
  );
}
