import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error Boundary caught an error:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // ✅ يمكن إرسال الخطأ لخدمة تتبع الأخطاء هنا
    // مثل Sentry أو LogRocket
  }

  handleReset = () => {
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // ✅ إعادة تحميل الصفحة إذا تكرر الخطأ أكثر من 3 مرات
    if (this.state.errorCount >= 3) {
      window.location.href = '/';
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-red-500/30">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 animate-bounce">⚠️</div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                حدث خطأ غير متوقع
              </h1>
              <p className="text-sm sm:text-base text-purple-300 mb-4">
                عذراً، حدث خطأ في التطبيق. يمكنك المحاولة مرة أخرى.
              </p>
              
              {/* ✅ تفاصيل الخطأ في وضع التطوير فقط */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-red-400 font-semibold mb-2">
                    تفاصيل الخطأ (للمطورين)
                  </summary>
                  <div className="bg-slate-900/50 p-3 rounded-lg text-xs text-red-300 overflow-auto max-h-40">
                    <p className="font-bold mb-1">{this.state.error.toString()}</p>
                    <pre className="whitespace-pre-wrap">
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
              >
                🔄 المحاولة مرة أخرى
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
              >
                🏠 العودة للرئيسية
              </button>
            </div>

            {this.state.errorCount >= 2 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-300 text-xs text-center">
                  💡 إذا استمر الخطأ، حاول تحديث الصفحة أو مسح الكاش
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;