import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Explorer } from './pages/Explorer';
import { UnitDetail } from './pages/UnitDetail';
import { SearchPlayground } from './pages/SearchPlayground';
import { BuildConsole } from './pages/BuildConsole';
import { BrandResolution } from './pages/BrandResolution';
import { TopologyExplorer } from './pages/TopologyExplorer';
import { Workbench } from './pages/Workbench';
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="explorer" element={<Explorer />} />
          <Route path="units/:id" element={<UnitDetail />} />
          <Route path="search" element={<SearchPlayground />} />
          <Route path="build" element={<BuildConsole />} />
          <Route path="brands" element={<BrandResolution />} />
          <Route path="topology" element={<TopologyExplorer />} />
          <Route path="workbench" element={<Workbench />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
