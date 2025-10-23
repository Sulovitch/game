import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function DrawingWordsInput() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId, playerName } = location.state || {};

  const [word, setWord] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [wordsCount, setWordsCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);

useEffect(() => {
  if (!roomId || !playerName) {
    navigate('/');
    return;
  }

  const socket = socketService.connect();

  socket.on('words-update', (data) => {
    setWordsCount(data.wordsCount);
    setTotalPlayers(data.totalPlayers);
  });

  // ✅✅✅ إضافة listener للعد التنازلي
  socket.on('countdown', (count) => {
    console.log('⏱️ العد التنازلي:', count);
    
    if (count === 0) {
      setTimeout(() => {
        navigate('/drawing-game', {
          state: { roomId, playerName },
          replace: true
        });
      }, 500);
    }
  });

  socket.emit('get-scores', { roomId });

  return () => {
    socket.off('words-update');
    socket.off('countdown'); // ✅ cleanup
  };
}, [roomId, playerName, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!word.trim()) {
      alert('الرجاء إدخال كلمة!');
      return;
    }

    if (word.trim().length < 2) {
      alert('الكلمة قصيرة جداً!');
      return;
    }

    socketService.emit('submit-word', { word: word.trim() });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 py-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-block p-3 md:p-4 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl mb-3 md:mb-4">
              <span className="text-4xl md:text-5xl">✏️</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              أدخل كلمة للرسم
            </h1>
            <p className="text-purple-300 text-sm md:text-base">
              اختر كلمة سيرسمها أحد اللاعبين الآخرين
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-purple-200 font-semibold mb-2 text-sm md:text-base">
                  كلمتك:
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="مثال: سيارة، شجرة، قطة..."
                  className="w-full px-4 md:px-6 py-3 md:py-4 bg-slate-700/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-base md:text-lg"
                  maxLength={20}
                  autoFocus
                />
                <p className="text-xs md:text-sm text-purple-300/70 mt-2">
                  💡 اختر كلمة واضحة وسهلة الرسم
                </p>
              </div>

              <button
                type="submit"
                disabled={!word.trim()}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3 md:py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-pink-500/50 disabled:shadow-none text-sm md:text-base"
              >
                ✅ تأكيد الكلمة
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4 md:space-y-6">
              <div className="text-5xl md:text-6xl animate-bounce">✅</div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-green-400 mb-2">
                  تم إرسال كلمتك!
                </h2>
                <p className="text-sm md:text-base text-purple-300">
                  في انتظار باقي اللاعبين...
                </p>
              </div>

              <div className="bg-slate-700/30 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-purple-500/20">
                <p className="text-sm md:text-base text-purple-200 font-semibold mb-2">
                  التقدم:
                </p>
                <div className="text-3xl md:text-4xl font-bold text-pink-400">
                  {wordsCount} / {totalPlayers}
                </div>
                <p className="text-xs md:text-sm text-purple-300/70 mt-2">
                  لاعب أدخل كلمته
                </p>

                <div className="w-full bg-slate-600/30 rounded-full h-2 md:h-3 mt-3 md:mt-4">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 md:h-3 rounded-full transition-all duration-500 shadow-lg shadow-pink-500/50"
                    style={{ 
                      width: totalPlayers > 0 ? `${(wordsCount / totalPlayers) * 100}%` : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-purple-500/20">
            <div className="text-center text-xs md:text-sm text-purple-300/80 space-y-1 md:space-y-2">
              <p>🎨 كل لاعب سيرسم كلمة واحدة</p>
              <p>⏱️ لديك 60 ثانية للرسم</p>
              <p>🎯 الهدف: خلي الآخرين يخمنون كلمتك</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrawingWordsInput;