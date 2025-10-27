import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import GameCategories from './pages/GameCategories';
import DrawingWordsInput from './pages/DrawingWordsInput';
import DrawingGame from './pages/DrawingGame';
import Results from './pages/Results';
import './animations.css';


// ✅ Wrapper محسّن مع Error Boundary لكل صفحة
function PageWrapper({ children }) {
  return (
    <ErrorBoundary>
      <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="h-full w-full overflow-y-auto scrollable">
          {children}
        </div>
      </div>
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <PageWrapper><Home /></PageWrapper>,
    errorElement: <ErrorBoundary><div>حدث خطأ في تحميل الصفحة</div></ErrorBoundary>
  },
  {
    path: '/lobby',
    element: <PageWrapper><Lobby /></PageWrapper>,
    errorElement: <ErrorBoundary><div>حدث خطأ في تحميل الصفحة</div></ErrorBoundary>
  },
  {
    path: '/game-categories',
    element: <PageWrapper><GameCategories /></PageWrapper>,
    errorElement: <ErrorBoundary><div>حدث خطأ في تحميل الصفحة</div></ErrorBoundary>
  },
  {
    path: '/drawing-words',
    element: <PageWrapper><DrawingWordsInput /></PageWrapper>,
    errorElement: <ErrorBoundary><div>حدث خطأ في تحميل الصفحة</div></ErrorBoundary>
  },
  {
    path: '/drawing-game',
    element: <PageWrapper><DrawingGame /></PageWrapper>,
    errorElement: <ErrorBoundary><div>حدث خطأ في تحميل الصفحة</div></ErrorBoundary>
  },
  {
    path: '/results',
    element: <PageWrapper><Results /></PageWrapper>,
    errorElement: <ErrorBoundary><div>حدث خطأ في تحميل الصفحة</div></ErrorBoundary>
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

    // ✅ معالجة الأخطاء غير المعالجة
    const handleError = (event) => {
      console.error('❌ Unhandled error:', event.error);
      // يمكن إضافة إشعار للمستخدم هنا
    };

    const handleRejection = (event) => {
      console.error('❌ Unhandled promise rejection:', event.reason);
      // يمكن إضافة إشعار للمستخدم هنا
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      style.overflow = '';
      style.position = '';
      style.width = '';
      style.height = '';
      style.overscrollBehavior = '';
      style.background = '';
      
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;