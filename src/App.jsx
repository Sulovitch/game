import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameCategories from './pages/GameCategories';
import DrawingWordsInput from './pages/DrawingWordsInput';
import DrawingGame from './pages/DrawingGame';
import Results from './pages/Results';

// ✅ Wrapper محسّن مع خلفية بنفسجية
function PageWrapper({ children }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="h-full w-full overflow-y-auto scrollable">
        {children}
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <PageWrapper><Home /></PageWrapper>
  },
  {
    path: '/lobby',
    element: <PageWrapper><Lobby /></PageWrapper>
  },
  {
    path: '/game-categories',
    element: <PageWrapper><GameCategories /></PageWrapper>
  },
  {
    path: '/drawing-words',
    element: <PageWrapper><DrawingWordsInput /></PageWrapper>
  },
  {
    path: '/drawing-game',
    element: <PageWrapper><DrawingGame /></PageWrapper>
  },
  {
    path: '/results',
    element: <PageWrapper><Results /></PageWrapper>
  }
]);

function App() {
  useEffect(() => {
    const style = document.body.style;
    style.overflow = 'hidden';
    style.position = 'fixed';
    style.width = '100%';
    style.height = '100%';
    style.overscrollBehavior = 'none';
    style.background = 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)';

    return () => {
      style.overflow = '';
      style.position = '';
      style.width = '';
      style.height = '';
      style.overscrollBehavior = '';
      style.background = '';
    };
  }, []);

  return <RouterProvider router={router} />;
}

export default App;