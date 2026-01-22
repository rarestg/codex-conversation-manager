import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import 'overlayscrollbars/overlayscrollbars.css';
import ConversationViewer from './features/conversation/ConversationViewer';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing root element');
}

ReactDOM.createRoot(root).render(
  <StrictMode>
    <ConversationViewer />
  </StrictMode>,
);
