import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

// The room pulls in PixiJS and PeerJS (most of the bundle); the landing page doesn't need them.
const Room = lazy(() => import('./pages/Room'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ color: '#aaa', padding: 24, fontFamily: 'sans-serif' }}>Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
