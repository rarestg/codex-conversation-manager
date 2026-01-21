import React from 'react';
import ReactDOM from 'react-dom/client';
import ConversationViewer from './ConversationViewer';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing root element');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ConversationViewer />
  </React.StrictMode>,
);
