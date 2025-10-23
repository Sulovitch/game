import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { results, playerName, roomId, isHost } = location.state || {};

  const [playersReady, setPlayersReady] = useState([]);
  const [gameChoice, setGameChoice] = useState('categories');
  const [imReady, setImReady] = useState(false);
  const [hostChoice, setHostChoice] = useState(null);

  useEffect(() => {
    if (!results || !roomId || !playerName) {
      navigate('/');
      return;
    }

    const socket = socketService.connect();

    socket.on('players-ready-update', (data) => {
      console.log('📊 تحديث الجاهزية:', data);
      setPlayersReady(data.playersReady);
      if (data.hostGameChoice) {
        setHostChoice(data.hostGameChoice);
      }
    });

    socket.on('game-restarting', (data) => {
      console.log('🔄 إعادة اللعبة:', data);
      navigate('/lobby', {
        state: {
          roomId: data.roomId,
          playerName: playerName,
          gameType: data.gameType,
          isHost: data.hostName === playerName, // ✅ تحديد isHost بناءً على hostName
          fromResults: true // ✅ إضافة flag لإعلام Lobby أننا عائدون من النتائج
        },
        replace: true
      });
    });

    socket.on('player-left', (data) => {
      console.log('🚪 لاعب غادر:', data);
      // يمكن إضافة إشعار للمستخدم
    });

    return () => {
      socket.off('players-ready-update');
      socket.off('game-restarting');
      socket.off('player-left');
    };
  }, [results, roomId, playerName, navigate]);

  const handlePlayerReady = () => {
    setImReady(true);
    
    // ✅ المضيف يرسل gameChoice، غير المضيف يرسل null
    const selectedGameType = isHost ? gameChoice : null;
    
    console.log('✅ اللاعب جاهز:', {
      playerName,
      isHost,
      gameChoice: selectedGameType
    });

    socketService.emit('player-ready', { 
      roomId, 
      playerName,
      gameType: selectedGameType, // ✅ إرسال gameType
      action: 'ready'
    });
  };

  const handleLeave = () => {
    console.log('🚪 المغادرة من صفحة النتائج');
    socketService.emit('player-ready', {
      roomId,
      playerName,
      action: 'leave'
    });
    socketService.disconnect();
    navigate('/');
  };

  if (!results) {
    return null;
  }

  const myResult = results.find(r => r.name === playerName);
  const totalPlayers = results.length;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        
        {/* البطاقة الرئيسية */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-purple-500/20 p-6 sm:p-8">
          
          {/* العنوان */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-5xl sm:text-6xl mb-3">🏆</div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              نتائج اللعبة
            </h1>
            <p className="text-purple-300 text-sm sm:text-base">
              أحسنتم! 🎉
            </p>
          </div>

          {/* الترتيب */}
          <div className="mb-6">
            <div className="space-y-3">
              {results.map((player, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                    player.name === playerName
                      ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500 shadow-lg scale-105'
                      : 'bg-slate-700/30 border-slate-600/30'
                  } ${
                    index === 0 ? 'ring-2 ring-yellow-500/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`text-3xl sm:text-4xl font-bold ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-slate-300' :
                      index === 2 ? 'text-orange-400' :
                      'text-slate-500'
                    }`}>
                      {index === 0 ? '🥇' :
                       index === 1 ? '🥈' :
                       index === 2 ? '🥉' :
                       `#${index + 1}`}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base sm:text-lg">
                          {player.name}
                        </span>
                        {player.name === playerName && (
                          <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                            أنت
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-purple-300">
                        المركز {player.rank} من {totalPlayers}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-400">
                      {player.score}
                    </div>
                    <div className="text-xs text-slate-400">نقطة</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* إحصائياتك */}
          {myResult && (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-2xl border border-indigo-500/30">
              <h3 className="text-white font-bold mb-3 text-base sm:text-lg text-center">
                📊 إحصائياتك
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-purple-400">
                    {myResult.rank}
                  </div>
                  <div className="text-xs sm:text-sm text-purple-300">المركز</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-green-400">
                    {myResult.score}
                  </div>
                  <div className="text-xs sm:text-sm text-purple-300">النقاط</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-blue-400">
                    {totalPlayers}
                  </div>
                  <div className="text-xs sm:text-sm text-purple-300">لاعبين</div>
                </div>
              </div>
            </div>
          )}

          {/* اختيار اللعبة التالية - للمضيف فقط */}
          {isHost && !imReady && (
            <div className="mb-6">
              <h3 className="text-white text-base sm:text-lg font-bold mb-3 text-center">
                🎮 اختر اللعبة التالية
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setGameChoice('categories')}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    gameChoice === 'categories'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-400 shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-purple-500/50'
                  }`}
                >
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="font-bold text-sm sm:text-base">لعبة الفئات</div>
                </button>

                <button
                  onClick={() => setGameChoice('drawing')}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    gameChoice === 'drawing'
                      ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-400 shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-purple-500/50'
                  }`}
                >
                  <div className="text-3xl mb-2">🎨</div>
                  <div className="font-bold text-sm sm:text-base">لعبة الرسم</div>
                </button>
              </div>
            </div>
          )}

          {/* عرض اختيار المضيف للاعبين الآخرين */}
          {!isHost && hostChoice && (
            <div className="mb-6 p-4 bg-purple-600/20 rounded-2xl border border-purple-500/30 text-center">
              <p className="text-purple-200 text-sm sm:text-base">
                👑 المضيف اختار: <span className="font-bold">
                  {hostChoice === 'drawing' ? '🎨 لعبة الرسم' : '⚡ لعبة الفئات'}
                </span>
              </p>
            </div>
          )}

          {/* حالة الجاهزية */}
          <div className="mb-6 p-4 bg-slate-700/30 rounded-2xl border border-slate-600/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-200 font-semibold text-sm sm:text-base">
                اللاعبون الجاهزون:
              </span>
              <span className="text-purple-400 font-bold text-base sm:text-lg">
                {playersReady.length} / {totalPlayers}
              </span>
            </div>
            
            <div className="space-y-2">
              {results.map((player) => (
                <div
                  key={player.name}
                  className="flex items-center justify-between text-xs sm:text-sm"
                >
                  <span className="text-slate-300">{player.name}</span>
                  <span>
                    {playersReady.includes(player.name) ? (
                      <span className="text-green-400">✓ جاهز</span>
                    ) : (
                      <span className="text-slate-500">⏳ في انتظار...</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* الأزرار */}
          <div className="space-y-3">
            {!imReady ? (
              <button
                onClick={handlePlayerReady}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg hover:shadow-green-500/50 transition-all"
              >
                ✅ جاهز للعبة التالية
              </button>
            ) : (
              <div className="w-full p-3 sm:p-4 bg-green-500/20 rounded-xl text-center text-green-300 font-semibold border border-green-500/30 text-sm sm:text-base">
                ✓ أنت جاهز - في انتظار الآخرين...
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
              <p>🎮 اضغط جاهز لبدء لعبة جديدة</p>
              <p>👥 يجب أن يكون جميع اللاعبين جاهزين</p>
              <p>🏆 استمتعوا باللعب!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Results;