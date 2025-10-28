import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { results, playerName, roomId, isHost } = location.state || {};

  const [playersReady, setPlayersReady] = useState([]);
  const [imReady, setImReady] = useState(false);
  const [drawings, setDrawings] = useState([]);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [tiebreakInfo, setTiebreakInfo] = useState(null);

  useEffect(() => {
    if (!results || !roomId || !playerName) {
      navigate('/');
      return;
    }

    const socket = socketService.connect();

    // ✅ طلب الرسومات من السيرفر
    socket.emit('get-game-drawings', { roomId });

    socket.on('game-drawings', (data) => {
      console.log('🎨 استقبال الرسومات:', data);
      setDrawings(data.drawings || []);
    });

    socket.on('players-ready-update', (data) => {
      console.log('📊 تحديث الجاهزية:', data);
      setPlayersReady(data.playersReady);
      
      // ✅ معلومات التعادل
      if (data.tiebreakMode) {
        setTiebreakInfo({
          enabled: true,
          tiedPlayers: data.tiedPlayers || []
        });
      }
    });

    // ✅ جولة فاصلة للتعادل
    socket.on('tiebreak-starting', (data) => {
      console.log('⚔️ بدء جولة فاصلة:', data);
      
      const amITied = data.tiedPlayers?.some(p => p.name === playerName);
      
      navigate('/lobby', {
        state: {
          roomId: data.roomId,
          playerName: playerName,
          gameType: data.gameType,
          isHost: data.hostName === playerName,
          fromTiebreak: true,
          tiebreakMode: true,
          tiedPlayers: data.tiedPlayers,
          isTiedPlayer: amITied
        },
        replace: true
      });
    });

    socket.on('game-restarting', (data) => {
      console.log('🔄 إعادة اللعبة:', data);
      navigate('/lobby', {
        state: {
          roomId: data.roomId,
          playerName: playerName,
          gameType: data.gameType,
          isHost: data.hostName === playerName,
          fromResults: true
        },
        replace: true
      });
    });

    socket.on('player-left', (data) => {
      console.log('🚪 لاعب غادر:', data);
    });

    return () => {
      socket.off('game-drawings');
      socket.off('players-ready-update');
      socket.off('tiebreak-starting');
      socket.off('game-restarting');
      socket.off('player-left');
    };
  }, [results, roomId, playerName, navigate]);

  // ✅ دالة لفحص التعادل وإطلاق الجولة الفاصلة
  const checkForTie = () => {
    if (!results || results.length < 2) return null;

    const topScore = results[0].score;
    const tiedPlayers = results.filter(p => p.score === topScore);

    if (tiedPlayers.length > 1) {
      return tiedPlayers;
    }
    return null;
  };

  const handlePlayerReady = () => {
    const tiedPlayers = checkForTie();
    
    setImReady(true);
    
    console.log('✅ اللاعب جاهز:', {
      playerName,
      isHost,
      hasTie: !!tiedPlayers
    });

    socketService.emit('player-ready', { 
      roomId, 
      playerName,
      action: 'ready',
      requestTiebreak: isHost && !!tiedPlayers
    });
  };

  const handleLeave = () => {
    console.log('🚪 المغادرة من صفحة النتائج');
    socketService.emit('player-ready', {
      roomId,
      playerName,
      action: 'leave'
    });
    
    setTimeout(() => {
      socketService.disconnect();
      navigate('/');
    }, 100);
  };

  // ✅ عرض رسمة معينة
  const showDrawing = (drawing) => {
    setSelectedDrawing(drawing);
    setShowDrawingModal(true);
  };

  // ✅ رسم Canvas من البيانات
  const renderDrawing = (canvasRef, drawingData) => {
    if (!canvasRef || !drawingData || !drawingData.length) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    
    // تعيين الحجم
    canvas.width = 800;
    canvas.height = 600;
    
    // خلفية بيضاء
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // إعدادات الرسم
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // إعادة رسم كل الخطوط
    drawingData.forEach((drawData) => {
      const x = drawData.x * canvas.width;
      const y = drawData.y * canvas.height;

      ctx.strokeStyle = drawData.color || '#000000';
      ctx.lineWidth = drawData.brushSize || 3;
      
      if (drawData.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      if (drawData.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (drawData.type === 'draw') {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });
  };

  if (!results) {
    return null;
  }

  const myResult = results.find(r => r.name === playerName);
  const totalPlayers = results.length;
  const tiedPlayers = checkForTie();

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

          {/* ✅ تنبيه التعادل */}
          {tiedPlayers && tiedPlayers.length > 1 && isHost && !imReady && (
            <div className="mb-6 p-4 bg-yellow-500/20 rounded-2xl border border-yellow-500/30">
              <p className="text-yellow-200 text-center font-bold text-sm sm:text-base">
                ⚔️ يوجد تعادل بين {tiedPlayers.length} لاعبين! 
                <br />
                <span className="text-yellow-100 text-xs">
                  سيتم بدء جولة فاصلة تلقائياً عند الاستعداد
                </span>
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {tiedPlayers.map(p => (
                  <span key={p.name} className="text-yellow-300 text-sm bg-yellow-500/20 px-2 py-1 rounded">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

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
                        {/* ✅ علامة التعادل */}
                        {tiedPlayers && tiedPlayers.some(p => p.name === player.name) && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">
                            ⚔️ متعادل
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

          {/* ✅ عرض الرسومات */}
          {drawings && drawings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white text-base sm:text-lg font-bold mb-3 text-center">
                🎨 الرسومات
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {drawings.map((drawing, idx) => (
                  <div
                    key={idx}
                    onClick={() => showDrawing(drawing)}
                    className="bg-slate-700/30 rounded-xl p-3 border border-purple-500/20 cursor-pointer hover:border-purple-500 transition-all hover:scale-105"
                  >
                    <canvas
                      ref={(ref) => {
                        if (ref && drawing.drawings) {
                          renderDrawing(ref, drawing.drawings);
                        }
                      }}
                      className="w-full h-24 bg-white rounded-lg mb-2"
                    />
                    <div className="text-center">
                      <p className="text-purple-300 text-xs font-semibold">
                        {drawing.drawerName}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {drawing.word}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
                {tiedPlayers && tiedPlayers.length > 1 && isHost
                  ? '⚔️ جاهز لجولة فاصلة'
                  : '✅ جاهز للعبة التالية'}
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
              <p>💥 يجب أن يكون جميع اللاعبين جاهزين</p>
              {tiedPlayers && tiedPlayers.length > 1 && (
                <p className="text-yellow-300">⚔️ سيتم بدء جولة فاصلة للمتعادلين!</p>
              )}
              <p>🏆 استمتعوا باللعب!</p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Modal لعرض الرسمة بالحجم الكامل */}
      {showDrawingModal && selectedDrawing && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDrawingModal(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white text-xl font-bold">
                  🎨 رسمة {selectedDrawing.drawerName}
                </h3>
                <p className="text-purple-300">الكلمة: {selectedDrawing.word}</p>
              </div>
              <button
                onClick={() => setShowDrawingModal(false)}
                className="text-white hover:text-red-400 text-3xl"
              >
                ✕
              </button>
            </div>
            <canvas
              ref={(ref) => {
                if (ref && selectedDrawing.drawings) {
                  renderDrawing(ref, selectedDrawing.drawings);
                }
              }}
              className="w-full bg-white rounded-xl"
              style={{ maxHeight: '70vh' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Results;