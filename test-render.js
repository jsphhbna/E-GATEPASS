import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { LandingPage } from './src/pages/LandingPage';
import { MemoryRouter } from 'react-router-dom';

try {
  const html = renderToString(createElement(MemoryRouter, null, createElement(LandingPage)));
  console.log("Render successful");
} catch (error) {
  console.error("RENDER ERROR:", error);
}
