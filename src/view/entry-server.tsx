import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './app.js';

// Static imports of all view components
import HomeView from '../app/views/home.js';
import UserListView from '../users/views/user-list.js';
import UserProfileView from '../users/views/user-profile.js';

// View registry - maps path to component
const viewRegistry: Record<string, React.ComponentType<any>> = {
  'app/views/home': HomeView,
  'users/views/user-list': UserListView,
  'users/views/user-profile': UserProfileView,
};

export async function renderComponent(
  componentPath: string,
  props: any = {},
): Promise<string> {
  try {
    const Component = viewRegistry[componentPath];

    if (!Component) {
      throw new Error(
        `Component not found at path: ${componentPath}. Available paths: ${Object.keys(viewRegistry).join(', ')}`,
      );
    }

    // Render the component wrapped in App
    const html = renderToString(
      <App>
        <Component {...props} />
      </App>,
    );

    return html;
  } catch (error) {
    console.error(`Failed to render component at ${componentPath}:`, error);
    throw error;
  }
}
