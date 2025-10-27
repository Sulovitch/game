import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function GameCategories() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId, playerName } = location.state || {};
  const [isNavigating, setIsNavigating] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // ✅ منع تسجيل listeners متعددة
  const hasSetupSocketRef = useRef(false);

  const [currentCategory, setCurrentCategory] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [answer, setAnswer] = useState('');
  const [scores, setScores] = useState([]);
  const [recentAnswers, setRecentAnswers] = useState([]);
  const [mathQuestion, setMathQuestion] = useState(null);
  const [showScores, setShowScores] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const showFeedback = (message, type) => {
    setFeedbackMessage({ message, type });
    setTimeout(() => setFeedbackMessage(null), 2000);
  };

  useEffect(() => {
    if (!gameEnded) {
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [gameEnded]);

  // ✅ Socket Events - مع منع التسجيل المتعدد
  useEffect(() => {
    if (!roomId || !playerName) {
      navigate('/');
      return;
    }

    // ✅ منع تسجيل listeners متعددة
    if (hasSetupSocketRef.current) {
      console.log('⚠️ Socket listeners مسجلة بالفعل - تجاهل');
      return;
    }

    hasSetupSocketRef.current = true;
    console.log('✅ تسجيل Socket listeners للمرة الأولى');

    const socket = socketService.connect();
    socketService.setRoomInfo(roomId, playerName);

    // ============= Socket Event Handlers =============

    const handleReconnect = () => {
      console.log('🔄 إعادة الاتصال - الانضمام للغرفة مرة أخرى');
      socket.emit('join-room', { roomId, playerName });
      socket.emit('get-scores', { roomId });
      socket.emit('request-category', { roomId });
    };

    const handlePlayerRejoined = (data) => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: `🔄 ${data.playerName} عاد للعبة`
      }]);
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== Date.now()));
      }, 3000);
    };

    const handlePlayerDisconnected = (data) => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'warning',
        message: `⚠️ ${data.playerName} انقطع اتصاله`
      }]);
      
      setTimeout(() => {
        setNotifications(prev => prev.slice(0, -1));
      }, 3000);
    };

    const handlePlayerLeft = (data) => {
      console.log('🚪 لاعب غادر:', data);
      
      // ✅ تحديث قائمة النقاط لحذف اللاعب
      setScores(prev => prev.filter(p => p.name !== data.playerName));
      
      // ✅ إظهار إشعار
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `🚪 ${data.playerName} غادر اللعبة`
      }]);
      
      setTimeout(() => {
        setNotifications(prev => prev.slice(0, -1));
      }, 3000);
    };

    const handlePlayerLeftPermanently = (data) => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `❌ ${data.playerName} غادر اللعبة`
      }]);
      
      setTimeout(() => {
        setNotifications(prev => prev.slice(0, -1));
      }, 3000);
    };

    const handleCategoryStarted = (data) => {
      console.log('📚 بدء فئة:', data);
      
      setCurrentCategory(data.category);
      setRecentAnswers([]);
      setAnswer('');
      setMathQuestion(data.mathQuestion || null);
      
      if (data.timeLeft !== undefined) {
        console.log('⏱️ الوقت المتبقي:', data.timeLeft);
        setTimeLeft(data.timeLeft);
      } else if (data.startTime) {
        const serverStartTime = data.startTime;
        const now = Date.now();
        const elapsed = Math.floor((now - serverStartTime) / 1000);
        const remaining = Math.max(0, data.category.duration - elapsed);
        setTimeLeft(remaining);
      } else {
        setTimeLeft(data.category.duration);
      }
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleNewMathQuestion = (data) => {
      setMathQuestion(data.mathQuestion);
    };

    const handleAnswerResult = (data) => {
      setRecentAnswers(prev => [{
        playerName: data.playerName,
        answer: data.answer,
        isCorrect: data.isCorrect,
        isDuplicate: data.isDuplicate,
        id: Date.now()
      }, ...prev.slice(0, 4)]);

      if (data.playerName === playerName) {
        if (data.isCorrect) {
          showFeedback('✅ إجابة صحيحة! +1', 'success');
        } else if (data.isDuplicate) {
          showFeedback('⚠️ كلمة مكررة!', 'warning');
        } else {
          showFeedback('❌ إجابة خاطئة', 'error');
        }
      }
    };

    const handleScoresUpdate = (data) => {
      console.log('📊 تحديث النقاط:', data.scores);
      setScores(data.scores.sort((a, b) => b.score - a.score));
    };

    const handleCountdown = (count) => {
      console.log('عد تنازلي:', count);
    };

    const handleGameFinished = (data) => {
      if (isNavigating) return;
      
      setGameEnded(true);
      setIsNavigating(true);
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      const isHost = data.hostName === playerName;
      
      setTimeout(() => {
        navigate('/results', { 
          state: { 
            results: data.results,
            playerName: playerName,
            roomId: data.roomId,
            isHost: isHost
          },
          replace: true
        });
      }, 100);
    };

    // ============= تسجيل جميع الـ listeners =============

    socket.on('connect', handleReconnect);
    socket.on('player-rejoined', handlePlayerRejoined);
    socket.on('player-disconnected', handlePlayerDisconnected);
    socket.on('player-left', handlePlayerLeft);
    socket.on('player-left-permanently', handlePlayerLeftPermanently);
    socket.on('category-started', handleCategoryStarted);
    socket.on('new-math-question', handleNewMathQuestion);
    socket.on('answer-result', handleAnswerResult);
    socket.on('scores-update', handleScoresUpdate);
    socket.on('countdown', handleCountdown);
    socket.on('game-finished', handleGameFinished);

    // ✅ الآن نرسل join-room بعد تسجيل الـ listeners
    console.log(`📡 الانضمام للغرفة ${roomId} باسم ${playerName}`);
    socket.emit('join-room', { roomId, playerName });
    socket.emit('get-scores', { roomId });
    socket.emit('request-category', { roomId });

    // ============= Cleanup =============
    return () => {
      console.log('🧹 تنظيف Socket listeners');
      
      socket.off('connect', handleReconnect);
      socket.off('player-rejoined', handlePlayerRejoined);
      socket.off('player-disconnected', handlePlayerDisconnected);
      socket.off('player-left', handlePlayerLeft);
      socket.off('player-left-permanently', handlePlayerLeftPermanently);
      socket.off('category-started', handleCategoryStarted);
      socket.off('new-math-question', handleNewMathQuestion);
      socket.off('answer-result', handleAnswerResult);
      socket.off('scores-update', handleScoresUpdate);
      socket.off('countdown', handleCountdown);
      socket.off('game-finished', handleGameFinished);
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      // ✅ إعادة تعيين flag عند unmount
      hasSetupSocketRef.current = false;
    };
  }, [roomId, playerName, navigate, isNavigating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim() || !currentCategory) return;

    socketService.emit('submit-answer', { answer: answer.trim() });
    setAnswer('');
    inputRef.current?.focus();
  };

  const handleConfirmLeave = () => {
    setGameEnded(true);
    setShowLeaveConfirm(false);
    
    console.log('🚪 المغادرة من لعبة الفئات');
    
    // ✅ إرسال حدث المغادرة أولاً
    socketService.emit('player-leave', { roomId, playerName });
    
    // ✅ الانتظار قليلاً للسماح بإرسال الحدث ثم قطع الاتصال
    setTimeout(() => {
      socketService.clearRoomInfo();
      socketService.disconnect();
      navigate('/');
    }, 100);
  };

  const handleCancelLeave = () => {
    setShowLeaveConfirm(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      
      {/* الإشعارات */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-6 py-3 rounded-xl shadow-2xl font-bold text-sm animate-slide-up backdrop-blur-sm ${
              notification.type === 'success' ? 'bg-green-500/90 text-white border border-green-400' :
              notification.type === 'warning' ? 'bg-orange-500/90 text-white border border-orange-400' :
              'bg-red-500/90 text-white border border-red-400'
            }`}
          >
            {notification.message}
          </div>
        ))}
      </div>

      {/* زر المغادرة */}
      <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-40">
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="group relative overflow-hidden bg-slate-800/95 backdrop-blur-xl text-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl font-bold shadow-2xl border-2 border-red-500/40 transition-all duration-300 hover:scale-105 hover:border-red-500 hover:shadow-red-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/30 to-red-600/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
          
          <div className="relative flex items-center gap-2.5">
            <span className="text-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
              🚪
            </span>
            <span className="hidden sm:inline text-base sm:text-lg font-bold bg-gradient-to-r from-red-200 to-rose-100 bg-clip-text text-transparent group-hover:from-white group-hover:to-red-100 transition-all duration-300">
              مغادرة
            </span>
          </div>
        </button>
      </div>

      {/* نافذة تأكيد المغادرة */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-purple-500/30">
            <div className="text-center mb-6">
              <div className="text-4xl sm:text-6xl mb-4">⚠️</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                هل تريد المغادرة؟
              </h2>
              <p className="text-sm sm:text-base text-purple-300">
                إذا غادرت الآن سيتم فقدان تقدمك في اللعبة وسيؤثر ذلك على اللاعبين الآخرين.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleCancelLeave}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-lg text-sm sm:text-base"
              >
                ✅ البقاء
              </button>
              <button
                onClick={handleConfirmLeave}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-4 sm:px-6 py-3 rounded-xl font-bold shadow-lg text-sm sm:text-base"
              >   
                🚪 مغادرة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Message */}
      {feedbackMessage && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-xl shadow-2xl font-bold text-lg animate-bounce ${
          feedbackMessage.type === 'success' ? 'bg-green-500/90 backdrop-blur-sm text-white border border-green-400' :
          feedbackMessage.type === 'warning' ? 'bg-orange-500/90 backdrop-blur-sm text-white border border-orange-400' :
          'bg-red-500/90 backdrop-blur-sm text-white border border-red-400'
        }`}>
          {feedbackMessage.message}
        </div>
      )}

      {/* Scores Sidebar - للجوال */}
      <div className={`lg:hidden fixed inset-y-0 right-0 w-64 bg-slate-800/95 backdrop-blur-xl border-l border-purple-500/30 shadow-2xl transform transition-transform duration-300 z-40 ${
        showScores ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">📊 النقاط</h3>
            <button
              onClick={() => setShowScores(false)}
              className="text-purple-300 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {scores.map((player, index) => (
              <div
                key={player.name}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  player.name === playerName 
                    ? 'bg-purple-600/50 border border-purple-500/50' 
                    : 'bg-slate-700/50 border border-slate-600/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {index === 0 && <span className="text-xl">👑</span>}
                  <span className="font-semibold text-sm text-white">{player.name}</span>
                </div>
                <span className="text-lg font-bold text-purple-400">
                  {player.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {showScores && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setShowScores(false)}
        />
      )}

      <div className="max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          
          {/* القسم الرئيسي */}
          <div className="lg:col-span-2">
            {/* رأس اللعبة */}
            {currentCategory && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-4 sm:p-6 mb-3 sm:mb-4 border border-purple-500/20 shadow-2xl text-center">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-4xl sm:text-6xl">{currentCategory.icon}</div>
                  
                  <div className="flex items-center gap-2">
                    <div className={`text-2xl sm:text-4xl font-bold ${
                      timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-green-400'
                    }`}>
                      ⏱️ {timeLeft}
                    </div>
                    
                    <button
                      onClick={() => setShowScores(true)}
                      className="lg:hidden bg-purple-600/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg font-bold border border-purple-500/50"
                    >
                      📊
                    </button>
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-purple-400 mb-3">
                  {currentCategory.name}
                </h2>
                
                {currentCategory.id === 'math' && mathQuestion && (
                  <div className="bg-slate-700/50 p-4 sm:p-6 rounded-xl border border-purple-500/30">
                    <p className="text-2xl sm:text-4xl font-bold text-white">
                      {mathQuestion.question} = ?
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* حقل الإجابة */}
            {currentCategory && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-4 sm:p-6 mb-3 sm:mb-4 border border-purple-500/20 shadow-2xl">
                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={currentCategory.id === 'math' ? 'اكتب الجواب فقط' : 'اكتب إجابتك...'}
                      className="w-full px-4 sm:px-6 py-4 bg-slate-700/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-lg sm:text-xl text-center"
                      disabled={timeLeft === 0}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!answer.trim() || timeLeft === 0}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 text-white px-6 py-4 rounded-xl font-bold text-lg disabled:cursor-not-allowed shadow-lg"
                    >
                      📤 إرسال الإجابة
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* آخر المحاولات */}
            {recentAnswers.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-purple-500/20 shadow-2xl">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 text-center">
                  📢 آخر المحاولات
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollable">
                  {recentAnswers.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg flex items-center justify-between border ${
                        item.isCorrect 
                          ? 'bg-green-500/20 border-green-500/30' 
                          : item.isDuplicate 
                            ? 'bg-orange-500/20 border-orange-500/30' 
                            : 'bg-red-500/20 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-semibold text-purple-200 text-sm sm:text-base">
                          👤 {item.playerName}:
                        </span>
                        {item.isCorrect ? (
                          <span className="text-green-400 font-bold">✅</span>
                        ) : item.isDuplicate ? (
                          <span className="text-orange-300 text-sm sm:text-base">{item.answer} مكررة ⚠️</span>
                        ) : (
                          <span className="text-slate-300 text-sm sm:text-base">{item.answer} ❌</span>
                        )}
                      </div>
                      {item.isCorrect && (
                        <span className="text-green-400 font-bold text-sm">+1</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* الشريط الجانبي - للكمبيوتر فقط */}
          <div className="hidden lg:block">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/20 shadow-2xl sticky top-4">
              <h3 className="text-lg font-bold text-white mb-4 text-center">
                📊 النقاط
              </h3>
              <div className="space-y-3">
                {scores.map((player, index) => (
                  <div
                    key={player.name}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      player.name === playerName 
                        ? 'bg-purple-600/50 border border-purple-500/50' 
                        : 'bg-slate-700/50 border border-slate-600/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {index === 0 && <span className="text-xl">👑</span>}
                      <span className="font-semibold text-white">{player.name}</span>
                    </div>
                    <span className="text-xl font-bold text-purple-400">
                      {player.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameCategories;