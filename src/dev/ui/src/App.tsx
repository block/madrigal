import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Layers } from './pages/Layers';
import { LayerDetail } from './pages/LayerDetail';
import { Studio } from './pages/Studio';
import { Author } from './pages/Author';
import { TopologyExplorer } from './pages/TopologyExplorer';

function RedirectToLayer() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/layers/${id}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Layers />} />
          <Route path="layers/:id" element={<LayerDetail />} />
          <Route path="studio" element={<Studio />} />
          <Route path="author" element={<Author />} />
          <Route path="topology" element={<TopologyExplorer />} />
          {/* Redirects from old routes */}
          <Route path="explorer" element={<Navigate to="/" replace />} />
          <Route path="search" element={<Navigate to="/studio" replace />} />
          <Route path="build" element={<Navigate to="/studio" replace />} />
          <Route path="brands" element={<Navigate to="/studio" replace />} />
          <Route path="workbench" element={<Navigate to="/author" replace />} />
          <Route path="units/:id" element={<RedirectToLayer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
