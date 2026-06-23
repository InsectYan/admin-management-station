import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/MainLayout.jsx';
import NovelListPage from './views/NovelListPage.jsx';
import NovelDetailPage from './views/NovelDetailPage.jsx';
import NovelCreationPage from './views/NovelCreationPage.jsx';
import AgentChatPage from './views/AgentChatPage.jsx';

export default function App({ basename = '/media/novel' }) {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="novels" replace />} />
          <Route path="novels" element={<NovelListPage />} />
          <Route path="novels/new" element={<NovelCreationPage />} />
          <Route path="novels/:id" element={<NovelDetailPage />} />
          <Route path="agent" element={<AgentChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
