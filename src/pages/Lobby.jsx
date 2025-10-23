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
  
  const hasJoinedRef = useRef(false);
  const isReturningFromResults = useRef(location.state?.fromResults || false);

  // ✅ تحديث isHost بناءً على أول لاعب في القائمة
  useEffect(() => {
    if (players.length > 0) {
      const firstPlayer = players[0];
      const amIHost = firstPlayer.name === playerName;
      
      if (isHost !== amIHost) {
        console.log(`🔄 تحديث isHost: كان ${isHost}, أصبح ${amIHost}`);
        setIsHost(amIHost);
      }
    }
  }, [players, playerName]);

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
    console.log('🔄 عودة من النتائج - لا حاجة لإرسال join-room');
    
    // ✅ BACKUP: إذا لم نحصل على room-update خلال 3 ثواني، اطلبه يدوياً
    setTimeout(() => {
      if (players.length === 0) {
        console.log('⚠️ لم نحصل على players بعد 3 ثواني - طلب room-update يدوياً');
        socket.emit('get-room-state', { roomId });
      }
    }, 3000);
  }

  socket.on('room-update', (data) => {
    console.log('📊 [room-update] استقبال تحديث الغرفة');
    console.log('   📋 عدد اللاعبين:', data.players?.length);
    console.log('   👥 اللاعبين:', data.players?.map(p => p.name).join(', '));
    
    if (data.players && data.players.length > 0) {
      setPlayers(data.players);
      setGameStatus(data.status);
      if (data.wordMode) {
        setWordMode(data.wordMode);
      }
    } else {
      console.warn('⚠️ room-update بدون لاعبين!');
    }
  });

  socket.on('game-restarting', (data) => {
    console.log('🔄 [game-restarting] إعادة تشغيل اللعبة');
    console.log('   🎮 نوع اللعبة:', data.gameType);
    console.log('   👑 الهوست:', data.hostName);
    console.log('   📋 اللاعبين في state:', players.length);
    
    setGameType(data.gameType);
    const amIHost = data.hostName === playerName;
    setIsHost(amIHost);
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

  return () => {
    console.log('🧹 Cleanup - إزالة listeners');
    socket.off('room-update');
    socket.off('game-restarting');
    socket.off('word-mode-updated');
    socket.off('waiting-for-words');
    socket.off('countdown');
    socket.off('error');
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

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    socketService.disconnect();
    navigate('/');
  };

  // ✅ عرض حالة التحميل إذا لم نحصل على قائمة اللاعبين بعد
  if (players.length === 0) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">⏳ جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        
        {/* العد التنازلي */}
        {countdown !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-white text-6xl sm:text-9xl font-bold animate-pulse">
              {countdown === 0 ? 'ابدأ! 🚀' : countdown}
            </div>
          </div>
        )}

        {/* البطاقة الرئيسية */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-purple-500/20 p-6 sm:p-8">
          
          {/* العنوان */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-5xl sm:text-6xl mb-3">
              {gameType === 'drawing' ? '🎨' : '⚡'}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {gameType === 'drawing' ? 'غرفة الرسم' : 'غرفة الانتظار'}
            </h1>
            <p className="text-purple-300 text-sm sm:text-base">
              في انتظار اللاعبين للبدء
            </p>
          </div>

          {/* رمز الغرفة */}
          <div className="mb-6 p-4 sm:p-6 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl border border-purple-500/30">
            <p className="text-purple-300 text-sm sm:text-base mb-3 text-center font-semibold">
              📋 رمز الغرفة
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
              <span className="text-3xl sm:text-4xl font-bold text-white tracking-wider">
                {roomId}
              </span>
              <button
                onClick={copyRoomId}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:shadow-purple-500/50 font-semibold text-sm sm:text-base"
              >
                {copied ? '✓ تم النسخ' : '📋 نسخ'}
              </button>
            </div>
            <p className="text-purple-300 text-xs sm:text-sm text-center">
              شارك هذا الرمز مع أصدقائك للانضمام
            </p>
          </div>

          {/* اللاعبون */}
          <div className="mb-6">
            <h3 className="text-white text-lg sm:text-xl font-bold mb-4 flex items-center justify-between">
              <span>👥 اللاعبون</span>
              <span className="text-purple-400">({players.length}/4)</span>
            </h3>
            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 sm:p-4 bg-slate-700/50 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {player.name?.charAt(0) || '؟'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-white block text-sm sm:text-base truncate">
                        {player.name}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {index === 0 && (
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
    </div>
  );
}

export default Lobby;