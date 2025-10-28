import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function Lobby() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId, playerName, gameType: initialGameType, isHost: initialIsHost } = location.state || {};

  const [players, setPlayers] = useState([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [countdown, setCountdown] = useState(null);
  const [copied, setCopied] = useState(false);
  const [wordMode, setWordMode] = useState('player');
  const [gameType, setGameType] = useState(initialGameType);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [showKickModal, setShowKickModal] = useState(false);
  const [playerToKick, setPlayerToKick] = useState(null);
  const [wasKicked, setWasKicked] = useState(false);
  const [showDrawingTutorial, setShowDrawingTutorial] = useState(false); // ✅ شرح لعبة الرسم
  const [showCategoriesTutorial, setShowCategoriesTutorial] = useState(false); // ✅ شرح لعبة الفئات
  const [actualHostName, setActualHostName] = useState(null); // ✅ اسم المضيف الفعلي
  const [lastGameResults, setLastGameResults] = useState(null); // ✅ نتائج آخر لعبة
  const [showLastResults, setShowLastResults] = useState(false); // ✅ عرض نتائج آخر لعبة
  
  const hasJoinedRef = useRef(false);
  const isReturningFromResults = useRef(location.state?.fromResults || false);

    useEffect(() => {
  if (!roomId || !playerName) {
    navigate('/');
    return;
  }

  if (hasJoinedRef.current) {
    console.log('⚠️ تم تجاهل useEffect المتكرر');
    return;
  }

  hasJoinedRef.current = true;
  console.log('✅ تنفيذ useEffect - الانضمام للغرفة');

  const socket = socketService.connect();
  
  // ✅ إرسال join-room فقط إذا لم نكن عائدين من صفحة النتائج
  if (!isReturningFromResults.current) {
    console.log('📤 إرسال join-room');
    socket.emit('join-room', { roomId, playerName });
   } else {
    console.log('🔄 عودة من النتائج - طلب room-update فوراً');
    
    // ✅ طلب room-update فوراً عند العودة
    socket.emit('get-room-state', { roomId });
    
    // ✅ BACKUP: إذا لم نحصل على room-update خلال 1 ثانية، اطلبه مرة أخرى
    setTimeout(() => {
      if (players.length === 0) {
        console.log('⚠️ لم نحصل على players بعد 1 ثانية - طلب room-update مرة أخرى');
        socket.emit('get-room-state', { roomId });
      }
    }, 1000);
  }

  socket.on('room-update', (data) => {
    console.log('📊 [room-update] استقبال تحديث الغرفة');
    console.log('   📋 عدد اللاعبين:', data.players?.length);
    console.log('   👥 اللاعبين:', data.players?.map(p => p.name).join(', '));
    console.log('   🎮 نوع اللعبة:', data.gameType);
    console.log('   👑 الهوست:', data.hostName);
    
    if (data.players && data.players.length > 0) {
      setPlayers(data.players);
      setGameStatus(data.status);
      
      // ✅ حفظ اسم المضيف الفعلي
      if (data.hostName) {
        setActualHostName(data.hostName);
        const amIHost = data.hostName === playerName;
        setIsHost(amIHost);
        console.log(`   ✅ أنت ${amIHost ? '👑 المضيف' : '👤 لاعب'}`);
      }
      
      // ✅ تحديث نوع اللعبة
      if (data.gameType) {
        setGameType(data.gameType);
      }
      
      if (data.wordMode) {
        setWordMode(data.wordMode);
      }
    } else {
      console.warn('⚠️ room-update بدون لاعبين!');
    }
    
    // ✅ حفظ نتائج آخر لعبة إذا كانت موجودة
    if (data.lastResults && data.lastResults.length > 0) {
      setLastGameResults(data.lastResults);
      console.log('📊 تم استقبال نتائج آخر لعبة:', data.lastResults.length, 'لاعبين');
    }
  });

  socket.on('game-restarting', (data) => {
    console.log('🔄 [game-restarting] إعادة تشغيل اللعبة');
    console.log('   🎮 نوع اللعبة:', data.gameType);
    console.log('   👑 الهوست:', data.hostName);
    console.log('   📋 اللاعبين في state:', players.length);
    
    setGameType(data.gameType);
    setActualHostName(data.hostName);
    const amIHost = data.hostName === playerName;
    setIsHost(amIHost);
    
    // ✅ حفظ نتائج آخر لعبة إذا كانت موجودة
    if (data.lastResults && data.lastResults.length > 0) {
      setLastGameResults(data.lastResults);
    }
    
    console.log(`   ✅ أنت ${amIHost ? '👑 المضيف' : '👤 لاعب'}`);
  });

  socket.on('word-mode-updated', (data) => {
    setWordMode(data.wordMode);
  });

  socket.on('waiting-for-words', (data) => {
    console.log('📝 استقبال طلب الكلمات في Lobby:', data);
    navigate('/drawing-words', { 
      state: { roomId, playerName },
      replace: true 
    });
  });

  socket.on('countdown', (count) => {
    console.log('⏱️ استقبال العد التنازلي:', count);
    setCountdown(count);
    
    if (count === 0) {
      setTimeout(() => {
        console.log('🚀 الانتقال للعبة - النوع:', gameType);
        if (gameType === 'drawing') {
          navigate('/drawing-game', { 
            state: { roomId, playerName },
            replace: true 
          });
        } else {
          navigate('/game-categories', { 
            state: { roomId, playerName },
            replace: true 
          });
        }
      }, 500);
    }
  });

  socket.on('error', (message) => {
    alert(message);
    navigate('/');
  });

  // ✅ listener للطرد
  socket.on('kicked', (data) => {
    console.log('👢 تم طردك من الغرفة:', data);
    setWasKicked(true);
    
    // الانتظار 3 ثواني ثم الرجوع للصفحة الرئيسية
    setTimeout(() => {
      socketService.disconnect();
      navigate('/');
    }, 3000);
  });

  // ✅ listener لتغيير نوع اللعبة
  socket.on('game-type-changed', (data) => {
    console.log('🎮 تم تغيير نوع اللعبة:', data);
    setGameType(data.gameType);
    // تم إزالة alert لتجربة أفضل
  });

  return () => {
    console.log('🧹 Cleanup - إزالة listeners');
    socket.off('room-update');
    socket.off('game-restarting');
    socket.off('word-mode-updated');
    socket.off('waiting-for-words');
    socket.off('countdown');
    socket.off('error');
    socket.off('kicked');
    socket.off('game-type-changed');
    hasJoinedRef.current = false;
  };
}, [roomId, playerName, navigate, gameType]);

  const handleStartGame = () => {
    if (players.length < 2) {
      alert('يجب أن يكون هناك على الأقل لاعبان!');
      return;
    }
    
    console.log('🚀 المضيف يبدأ اللعبة - النوع:', gameType, 'الوضع:', wordMode);
    socketService.emit('start-game', { wordMode });
  };

  const handleWordModeChange = (mode) => {
    setWordMode(mode);
    socketService.emit('change-word-mode', { roomId, wordMode: mode });
  };

  const copyRoomId = async () => {
    try {
      // ✅ محاولة استخدام Clipboard API الحديث
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // ✅ fallback للمتصفحات القديمة
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('فشل النسخ:', e);
        alert('فشل نسخ الرمز. انسخه يدوياً: ' + roomId);
      }
      document.body.removeChild(textArea);
    }
  };

  // ✅ دالة المغادرة المحدثة - المغادرة الفورية
  const handleLeave = () => {
    console.log('🚪 اللاعب يغادر الغرفة بشكل اختياري');
    // ✅ إرسال حدث المغادرة الاختيارية قبل قطع الاتصال
    socketService.emit('leave-room', { roomId, playerName });
    
    // الانتظار قليلاً للسماح بإرسال الحدث ثم قطع الاتصال
    setTimeout(() => {
      socketService.disconnect();
      navigate('/');
    }, 100);
  };

  // ✅ دالة طرد اللاعبين (للهوست فقط)
  const handleKickPlayer = (kickPlayerName) => {
    if (!isHost) return;
    if (kickPlayerName === playerName) {
      alert('لا يمكنك طرد نفسك!');
      return;
    }
    
    // ✅ فتح modal التأكيد
    setPlayerToKick(kickPlayerName);
    setShowKickModal(true);
  };

  // ✅ تأكيد الطرد
  const confirmKick = () => {
    if (playerToKick) {
      console.log('👢 طرد اللاعب:', playerToKick);
      socketService.emit('kick-player', { 
        roomId, 
        playerName: playerToKick 
      });
    }
    setShowKickModal(false);
    setPlayerToKick(null);
  };

  // ✅ إلغاء الطرد
  const cancelKick = () => {
    setShowKickModal(false);
    setPlayerToKick(null);
  };

  // ✅ تغيير نوع اللعبة
  const handleChangeGameType = (newGameType) => {
    if (!isHost) {
      alert('فقط المضيف يمكنه تغيير نوع اللعبة');
      return;
    }
    
    if (gameStatus !== 'waiting') {
      alert('لا يمكن تغيير نوع اللعبة أثناء اللعب');
      return;
    }

    console.log('🎮 طلب تغيير نوع اللعبة إلى:', newGameType);
    socketService.emit('change-game-type', { roomId, gameType: newGameType });
  };

  if (countdown !== null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-9xl font-bold text-white mb-4 animate-bounce">
            {countdown}
          </div>
          <div className="text-2xl text-purple-200">
            {countdown > 0 ? 'استعد...' : 'ابدأ!'}
          </div>
        </div>
      </div>
    );
  }

  // ✅ نافذة الطرد
  if (wasKicked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-3xl p-8 max-w-md w-full text-center border-2 border-red-500/50 shadow-2xl">
          <div className="text-6xl mb-4">👢</div>
          <h2 className="text-2xl font-bold text-white mb-2">تم طردك من الغرفة</h2>
          <p className="text-red-300 mb-4">المضيف قام بإخراجك من اللعبة</p>
          <p className="text-slate-400 text-sm">سيتم توجيهك للصفحة الرئيسية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-all duration-1000 ${
      gameType === 'drawing' 
        ? 'bg-gradient-to-br from-pink-900 via-purple-900 to-pink-800 animate-gradient-x' 
        : 'bg-gradient-to-br from-blue-900 via-cyan-900 to-indigo-900 animate-gradient-x'
    }`}>
      
      {/* نافذة شرح لعبة الرسم */}
      {showDrawingTutorial && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-purple-900/95 to-indigo-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border-2 border-purple-500/50 my-4">
            <div className="text-center mb-6">
              <div className="text-5xl sm:text-6xl mb-4">🎨</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                لعبة الرسم
              </h2>
              <p className="text-purple-300 text-sm sm:text-base">
                ارسم وخمن واكسب النقاط!
              </p>
            </div>
            
            <div className="space-y-4 text-right">
              {/* قواعد اللعبة */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-400/30">
                <h3 className="text-xl font-bold text-yellow-400 mb-3 flex items-center gap-2">
                  <span>📜</span>
                  <span>قواعد اللعبة:</span>
                </h3>
                <div className="space-y-2 text-white text-sm sm:text-base">
                  <p>• كل لاعب يرسم مرة واحدة</p>
                  <p>• الرسام يرسم الكلمة اللي تظهر له</p>
                  <p>• اللاعبون الآخرون يحاولون تخمين الكلمة</p>
                  <p>• لديك 60 ثانية لكل جولة</p>
                  <p>• لديك 5 محاولات للتخمين</p>
                </div>
              </div>

              {/* نظام النقاط للخامنين */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-400/30">
                <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
                  <span>🎯</span>
                  <span>نقاط التخمين:</span>
                </h3>
                <div className="space-y-2 text-white text-sm sm:text-base">
                  <p className="flex items-start gap-2">
                    <span className="text-green-400 text-xl">⚡</span>
                    <span><strong className="text-green-300">نقاطك = 100 - الوقت المستغرق</strong></span>
                  </p>
                  <div className="mr-7 space-y-1 text-purple-200">
                    <p>• خمنت بعد 5 ثواني؟ <strong className="text-green-300">95 نقطة</strong> 🔥</p>
                    <p>• خمنت بعد 30 ثانية؟ <strong className="text-blue-300">70 نقطة</strong> ✨</p>
                    <p>• خمنت بعد 50 ثانية؟ <strong className="text-orange-300">50 نقطة</strong> 😐</p>
                  </div>
                  <p className="mr-7 text-yellow-200">
                    💡 <strong>كلما خمنت أسرع، نقاط أكثر!</strong>
                  </p>
                </div>
              </div>

              {/* نظام النقاط للرسام */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-purple-400/30">
                <h3 className="text-xl font-bold text-pink-400 mb-3 flex items-center gap-2">
                  <span>🎨</span>
                  <span>نقاط الرسم:</span>
                </h3>
                <div className="space-y-2 text-white text-sm sm:text-base">
                  <p className="flex items-start gap-2">
                    <span className="text-pink-400 text-xl">🏆</span>
                    <span><strong className="text-pink-300">نقاطك = (عدد اللاعبين اللي خمنوا × 25) + مكافأة</strong></span>
                  </p>
                  <div className="mr-7 space-y-1 text-purple-200">
                    <p>• كل اللاعبين خمنوا؟ <strong className="text-green-300">+50 نقطة إضافية!</strong> 🎉</p>
                    <p>• 3 لاعبين خمنوا: <strong className="text-blue-300">75 نقطة</strong></p>
                    <p>• ما أحد خمن؟ <strong className="text-red-300">0 نقطة</strong> 💀</p>
                  </div>
                  <p className="mr-7 text-yellow-200">
                    💡 <strong>ارسم واضح عشان الكل يخمن!</strong>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowDrawingTutorial(false)}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-4 rounded-xl font-bold shadow-lg text-base sm:text-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                ✅ فهمت!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة شرح لعبة الفئات */}
      {showCategoriesTutorial && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-blue-900/95 to-cyan-900/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border-2 border-blue-500/50 my-4">
            <div className="text-center mb-6">
              <div className="text-5xl sm:text-6xl mb-4">⚡</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                لعبة الفئات
              </h2>
              <p className="text-blue-300 text-sm sm:text-base">
                أجب بسرعة واكسب النقاط!
              </p>
            </div>
            
            <div className="space-y-4 text-right">
              {/* قواعد اللعبة */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-blue-400/30">
                <h3 className="text-xl font-bold text-yellow-400 mb-3 flex items-center gap-2">
                  <span>📜</span>
                  <span>قواعد اللعبة:</span>
                </h3>
                <div className="space-y-2 text-white text-sm sm:text-base">
                  <p>• تظهر لك فئة (مثل: بلاد، حيوانات، ألوان)</p>
                  <p>• اكتب أكبر عدد من الإجابات الصحيحة</p>
                  <p>• لديك 20 ثانية لكل فئة</p>
                  
                </div>
              </div>

              {/* نظام النقاط */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-blue-400/30">
                <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
                  <span>🎯</span>
                  <span>نظام النقاط:</span>
                </h3>
                <div className="space-y-2 text-white text-sm sm:text-base">
                  <p className="flex items-start gap-2">
                    <span className="text-green-400 text-xl">✅</span>
                    <span><strong className="text-green-300">كل إجابة صحيحة = نقطة</strong></span>
                  </p>
                  <div className="mr-7 space-y-1 text-blue-200">
                    
                    <p>❌ إجابة خاطئة: <strong className="text-red-300">0 نقاط</strong></p>
                    <p>⚠️ إجابة مكررة: <strong className="text-orange-300">0 نقاط</strong></p>
                  </div>
                  <p className="mr-7 text-yellow-200">
                    💡 <strong>فكر بسرعة واكتب إجابات متنوعة!</strong>
                  </p>
                </div>
              </div>

              {/* نصائح */}
              <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-4 border border-yellow-500/30">
                <h3 className="text-lg font-bold text-yellow-300 mb-2 flex items-center gap-2">
                  <span>💡</span>
                  <span>نصائح:</span>
                </h3>
                <div className="space-y-1 text-yellow-200 text-sm">
                  <p>• اكتب إجابات مختلفة لكل جولة</p>
                  <p>• لا تضيع وقتك على إجابة واحدة</p>
                  <p>• الكمية أهم من الكيفية!</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowCategoriesTutorial(false)}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-4 rounded-xl font-bold shadow-lg text-base sm:text-lg transition-all duration-300 hover:scale-105 active:scale-95"
              >
                ✅ فهمت!
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ✅ Modal تأكيد الطرد */}
      {showKickModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border-2 border-red-500/50 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">تأكيد الطرد</h3>
              <p className="text-slate-300">
                هل أنت متأكد من طرد <span className="font-bold text-red-400">{playerToKick}</span>؟
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmKick}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all"
              >
                👢 طرد
              </button>
              <button
                onClick={cancelKick}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className={`backdrop-blur-sm rounded-3xl p-6 sm:p-8 shadow-2xl border-2 transition-all duration-700 ${
          gameType === 'drawing'
            ? 'bg-gradient-to-br from-pink-900/40 to-purple-900/40 border-pink-500/30 shadow-pink-500/20'
            : 'bg-gradient-to-br from-blue-900/40 to-cyan-900/40 border-cyan-500/30 shadow-cyan-500/20'
        }`}>
          {/* العنوان */}
          <div className="text-center mb-6">
            <div className={`text-5xl sm:text-6xl mb-3 animate-bounce ${
              gameType === 'drawing' ? 'animate-pulse' : ''
            }`}>
              {gameType === 'drawing' ? '🎨' : '⚡'}
            </div>
            <h1 className={`text-3xl sm:text-4xl font-bold mb-2 transition-all duration-500 ${
              gameType === 'drawing'
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400'
            }`}>
              {gameType === 'drawing' ? '🎨 غرفة الرسم' : '⚡ غرفة الفئات'}
            </h1>
            <p className={`transition-all duration-500 ${
              gameType === 'drawing' ? 'text-pink-300' : 'text-cyan-300'
            }`}>
              {gameType === 'drawing' ? 'ارسم وخمن واستمتع!' : 'أجب بسرعة واربح!'}
            </p>
          </div>

          {/* رمز الغرفة */}
          <div className={`mb-6 p-4 sm:p-6 rounded-2xl border transition-all duration-500 ${
            gameType === 'drawing'
              ? 'bg-gradient-to-r from-pink-900/50 to-purple-900/50 border-pink-500/30'
              : 'bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-cyan-500/30'
          }`}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-2">
              <span className="text-slate-300 font-semibold text-sm sm:text-base whitespace-nowrap">
                رمز الغرفة:
              </span>
              <span className={`text-2xl sm:text-3xl font-bold text-white tracking-wider px-4 sm:px-6 py-2 rounded-xl border transition-all duration-500 ${
                gameType === 'drawing'
                  ? 'bg-pink-950/50 border-pink-500/30'
                  : 'bg-blue-950/50 border-cyan-500/30'
              }`}>
                {roomId}
              </span>
              <button
                onClick={copyRoomId}
                className={`text-white px-4 py-2 rounded-xl transition-all shadow-lg font-semibold text-sm sm:text-base ${
                  gameType === 'drawing'
                    ? 'bg-pink-600 hover:bg-pink-700 hover:shadow-pink-500/50'
                    : 'bg-cyan-600 hover:bg-cyan-700 hover:shadow-cyan-500/50'
                }`}
              >
                {copied ? '✓ تم النسخ' : '📋 نسخ'}
              </button>
            </div>
            <p className={`text-xs sm:text-sm text-center transition-all duration-500 ${
              gameType === 'drawing' ? 'text-pink-300' : 'text-cyan-300'
            }`}>
              شارك هذا الرمز مع أصدقائك للانضمام
            </p>
          </div>

          {/* اللاعبون */}
          <div className="mb-6">
            <h3 className={`text-lg sm:text-xl font-bold mb-4 flex items-center justify-between transition-all duration-500 ${
              gameType === 'drawing' ? 'text-pink-200' : 'text-cyan-200'
            }`}>
              <span>👥 اللاعبون</span>
              <div className="flex items-center gap-2">
                <span className={`transition-all duration-500 ${
                  gameType === 'drawing' ? 'text-pink-400' : 'text-cyan-400'
                }`}>({players.length}/4)</span>
                
                {/* ✅ أيقونة كأس نتائج آخر لعبة */}
                {lastGameResults && (
                  <button
                    onClick={() => setShowLastResults(true)}
                    className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${
                      gameType === 'drawing'
                        ? 'bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 border border-yellow-500/30'
                        : 'bg-green-600/30 hover:bg-green-600/50 text-green-300 border border-green-500/30'
                    }`}
                    title="نتائج آخر لعبة"
                  >
                    <span className="text-xl">🏆</span>
                  </button>
                )}
              </div>
            </h3>
            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all duration-500 ${
                    gameType === 'drawing'
                      ? 'bg-pink-900/30 border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-900/50'
                      : 'bg-blue-900/30 border-cyan-500/20 hover:border-cyan-500/40 hover:bg-blue-900/50'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 transition-all duration-500 ${
                      gameType === 'drawing'
                        ? 'bg-gradient-to-br from-pink-500 to-purple-500'
                        : 'bg-gradient-to-br from-cyan-500 to-blue-500'
                    }`}>
                      {player.name?.charAt(0) || '؟'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-white block text-sm sm:text-base truncate">
                        {player.name}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {actualHostName === player.name && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">
                            👑 المضيف
                          </span>
                        )}
                        {player.name === playerName && (
                          <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                            أنت
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* ✅ زر الطرد - يظهر للهوست فقط */}
                  {isHost && player.name !== playerName && (
                    <button
                      onClick={() => handleKickPlayer(player.name)}
                      className="bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-300 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold shrink-0 ml-2"
                      title="طرد اللاعب"
                    >
                      👢 طرد
                    </button>
                  )}
                  
                  <div className="text-green-400 text-xl shrink-0 ml-2">●</div>
                </div>
              ))}

              {[...Array(Math.max(0, 4 - players.length))].map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="flex items-center p-3 sm:p-4 bg-slate-700/30 rounded-xl border-2 border-dashed border-slate-600 opacity-50"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-600 rounded-full flex items-center justify-center text-slate-400 text-lg shrink-0">
                    ?
                  </div>
                  <span className="mr-3 text-slate-400 text-sm sm:text-base">في انتظار لاعب...</span>
                </div>
              ))}
            </div>
          </div>

          {/* ✅ تغيير نوع اللعبة - للمضيف فقط */}
          {isHost && (
            <div className="mb-6">
              <h3 className="text-white text-base sm:text-lg font-bold mb-3 text-center">
                🎮 نوع اللعبة
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleChangeGameType('drawing')}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    gameType === 'drawing'
                      ? 'bg-gradient-to-br from-pink-600 to-purple-700 text-white border-pink-400 shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-pink-500/50'
                  }`}
                >
                  <div className="text-3xl mb-2">🎨</div>
                  <div className="font-bold text-sm sm:text-base mb-1">لعبة الرسم</div>
                  <div className="text-xs text-slate-400">
                    ارسم وخمن
                  </div>
                </button>

                <button
                  onClick={() => handleChangeGameType('categories')}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    gameType === 'categories'
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-700 text-white border-blue-400 shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-blue-500/50'
                  }`}
                >
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="font-bold text-sm sm:text-base mb-1">لعبة الفئات</div>
                  <div className="text-xs text-slate-400">
                    أجب على الأسئلة
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ✅ كيف ألعب - للجميع */}
          <div className="mb-6">
            <h3 className="text-white text-base sm:text-lg font-bold mb-3 text-center">
              📚 كيف ألعب؟
            </h3>
            <div className="flex justify-center">
              {gameType === 'drawing' ? (
                <button
                  onClick={() => setShowDrawingTutorial(true)}
                  className="w-full sm:w-auto min-w-[250px] p-5 bg-gradient-to-br from-purple-600/20 to-pink-600/20 hover:from-purple-600/40 hover:to-pink-600/40 text-purple-200 rounded-xl border-2 border-purple-500/30 hover:border-purple-400/50 transition-all font-semibold shadow-lg hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
                >
                  <div className="text-4xl mb-2">🎨</div>
                  <div className="text-base sm:text-lg">شرح لعبة الرسم</div>
                </button>
              ) : (
                <button
                  onClick={() => setShowCategoriesTutorial(true)}
                  className="w-full sm:w-auto min-w-[250px] p-5 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 hover:from-blue-600/40 hover:to-cyan-600/40 text-blue-200 rounded-xl border-2 border-blue-500/30 hover:border-blue-400/50 transition-all font-semibold shadow-lg hover:shadow-cyan-500/30 hover:scale-105 active:scale-95"
                >
                  <div className="text-4xl mb-2">⚡</div>
                  <div className="text-base sm:text-lg">شرح لعبة الفئات</div>
                </button>
              )}
            </div>
          </div>

          {/* ✅✅✅ خيار وضع الكلمات - للمضيف فقط في لعبة الرسم ✅✅✅ */}
          {isHost && gameType === 'drawing' && (
            <div className="mb-6">
              <h3 className="text-white text-base sm:text-lg font-bold mb-3 text-center">
                📝 مصدر الكلمات
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleWordModeChange('player')}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    wordMode === 'player'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-400 shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-purple-500/50'
                  }`}
                >
                  <div className="text-3xl mb-2">👥</div>
                  <div className="font-bold text-sm sm:text-base mb-1">من اللاعبين</div>
                  <div className="text-xs text-slate-400">
                    كل لاعب يدخل كلمة
                  </div>
                </button>

                <button
                  onClick={() => handleWordModeChange('random')}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    wordMode === 'random'
                      ? 'bg-gradient-to-br from-pink-600 to-rose-600 text-white border-pink-400 shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-pink-500/50'
                  }`}
                >
                  <div className="text-3xl mb-2">🎲</div>
                  <div className="font-bold text-sm sm:text-base mb-1">كلمات عشوائية</div>
                  <div className="text-xs text-slate-400">
                    كلمات من النظام
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* الأزرار */}
          <div className="space-y-3">
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={gameStatus !== 'waiting' || players.length < 2}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gameStatus === 'waiting' ? '🚀 بدء اللعبة' : '⏳ اللعبة جارية...'}
              </button>
            ) : (
              <div className="w-full p-3 sm:p-4 bg-slate-700/50 rounded-xl text-center text-slate-300 font-semibold border border-slate-600 text-sm sm:text-base">
                ⏳ في انتظار المضيف لبدء اللعبة...
              </div>
            )}

            <button
              onClick={handleLeave}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:shadow-red-500/50 transition-all"
            >
              🚪 مغادرة الغرفة
            </button>
          </div>

          {/* تلميحات */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="text-center text-xs sm:text-sm text-purple-300 space-y-2">
              <p>💡 تأكد من اتصال الإنترنت قبل البدء</p>
              {gameType === 'drawing' && wordMode === 'player' && (
                <p>✏️ سيطلب من كل لاعب إدخال كلمة للرسم</p>
              )}
              {gameType === 'drawing' && wordMode === 'random' && (
                <p>🎲 سيتم اختيار الكلمات تلقائياً</p>
              )}
              <p>🏆 استمتع باللعب وحظ موفق!</p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Modal نتائج آخر لعبة */}
      {showLastResults && lastGameResults && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLastResults(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-xl font-bold">🏆 نتائج آخر لعبة</h3>
              <button
                onClick={() => setShowLastResults(false)}
                className="text-white hover:text-red-400 text-3xl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {lastGameResults.map((player, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-slate-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-white font-semibold">{player.name}</span>
                  </div>
                  <span className="text-purple-400 font-bold text-lg">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lobby;