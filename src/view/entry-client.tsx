import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './app';

// Static imports - same as entry-server
import HomeView from '../app/views/home';
import UserListView from '../users/views/user-list';
import UserProfileView from '../users/views/user-profile';

// Get initial state from server
declare global {
  interface Window {
    __INITIAL_STATE__: any;
    __COMPONENT_PATH__: string;
  }
}

// View registry - matches entry-server
const viewRegistry: Record<string, React.ComponentType<any>> = {
  'app/views/home': HomeView,
  'users/views/user-list': UserListView,
  'users/views/user-profile': UserProfileView,
};

function hydrate() {
  const initialState = window.__INITIAL_STATE__ || {};
  const componentPath = window.__COMPONENT_PATH__;

  if (!componentPath) {
    console.error('No component path found for hydration');
    return;
  }

  const Component = viewRegistry[componentPath];

  if (!Component) {
    console.error(`Component not found for hydration: ${componentPath}`);
    return;
  }

  // Hydrate the app
  const root = document.getElementById('root');
  if (root) {
    hydrateRoot(
      root,
      <App>
        <Component {...initialState} />
      </App>,
    );
    console.log('✅ React hydration complete');
  }
}

// Start hydration when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrate);
} else {
  hydrate();
}
