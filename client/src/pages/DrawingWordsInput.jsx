import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import { validateDrawingWord } from '../utils/validation';

function DrawingWordsInput() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId, playerName } = location.state || {};
  
  const [word, setWord] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);

  useEffect(() => {
    if (!roomId || !playerName) {
      navigate('/');
      return;
    }

    const socket = socketService.connect();

    socket.on('words-update', (data) => {
      console.log('📊 تحديث الكلمات:', data);
      setReadyCount(data.readyCount || 0);
      setTotalPlayers(data.totalPlayers || 0);
      setReadyPlayers(data.readyPlayers || []);
    });

    socket.on('player-editing-word', (data) => {
      console.log('✏️ لاعب يعدل كلمته:', data);
      setEditingPlayer(data.playerName);
      
      // إخفاء الإشعار بعد 3 ثواني
      setTimeout(() => {
        setEditingPlayer(null);
      }, 3000);
    });

    socket.on('countdown', (count) => {
      console.log('⏳ العد التنازلي:', count);
    });

    socket.on('your-turn-to-draw', () => {
      navigate('/drawing-game', {
        state: { roomId, playerName }
      });
    });

    socket.on('someone-drawing', () => {
      navigate('/drawing-game', {
        state: { roomId, playerName }
      });
    });

    return () => {
      socket.off('words-update');
      socket.off('player-editing-word');
      socket.off('countdown');
      socket.off('your-turn-to-draw');
      socket.off('someone-drawing');
    };
  }, [roomId, playerName, navigate]);

  // ✅ التحقق من الكلمة أثناء الكتابة
  const handleWordChange = (e) => {
    const value = e.target.value;
    setWord(value);
    
    // إزالة الخطأ عند بدء الكتابة
    if (error) {
      setError('');
    }
    
    // ✅ validation لحظي (اختياري)
    if (value.length > 30) {
      setError('الكلمة طويلة جداً (الحد الأقصى 30 حرف)');
    }
  };

  // ✅ إرسال الكلمة مع validation
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (hasSubmitted || isSubmitting) {
      return;
    }

    // ✅ التحقق من صحة الكلمة
    const validation = validateDrawingWord(word);
    
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // ✅ إرسال الكلمة المنظفة
      socketService.emit('submit-word', { 
        word: validation.sanitized 
      });
      
      setHasSubmitted(true);
      console.log('✅ تم إرسال الكلمة:', validation.sanitized);
    } catch (err) {
      console.error('❌ خطأ في إرسال الكلمة:', err);
      setError('فشل إرسال الكلمة. حاول مرة أخرى.');
      setIsSubmitting(false);
    }
  };

  // ✅ إعادة المحاولة - إلغاء الجاهزية وإشعار اللاعبين
  const handleRetry = () => {
    // ✅ إرسال event للسيرفر لإلغاء الجاهزية
    socketService.emit('start-editing-word');
    
    setHasSubmitted(false);
    setIsSubmitting(false);
    setWord('');
    setError('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-purple-500/20 shadow-2xl">
          
          {/* العنوان */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              اختر كلمة للرسم
            </h2>
            <p className="text-sm sm:text-base text-purple-300">
              سيرسم اللاعبون كلمتك وعليهم تخمينها
            </p>
          </div>

          {/* عداد الكلمات */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-purple-200 font-semibold">
                📊 الجاهزون:
              </span>
              <span className="text-2xl font-bold text-pink-400">
                {readyCount} / {totalPlayers || '?'}
              </span>
            </div>
            
            {/* شريط التقدم */}
            <div className="mt-3 bg-slate-700/50 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                style={{ 
                  width: `${totalPlayers ? (readyCount / totalPlayers) * 100 : 0}%` 
                }}
              />
            </div>

            {/* إشعار التعديل */}
            {editingPlayer && (
              <div className="mt-3 p-2 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                <p className="text-xs text-orange-300 text-center">
                  ✏️ {editingPlayer} يعدل كلمته...
                </p>
              </div>
            )}

            {/* قائمة اللاعبين اللي أرسلوا */}
            {readyPlayers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-500/20">
                <p className="text-xs text-purple-300 mb-2">✅ جاهزون:</p>
                <div className="flex flex-wrap gap-2">
                  {readyPlayers.map((player, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-xs text-green-300"
                    >
                      {player.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!hasSubmitted ? (
            <form onSubmit={handleSubmit}>
              {/* حقل الإدخال */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-purple-200 mb-2">
                  الكلمة *
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={handleWordChange}
                  placeholder="مثال: قطة، سيارة، شمس..."
                  className={`w-full px-4 py-3 bg-slate-700/50 border ${
                    error ? 'border-red-500' : 'border-purple-500/30'
                  } rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-lg text-center`}
                  disabled={isSubmitting}
                  maxLength={30}
                  autoFocus
                  dir="rtl"
                />
                
                {/* رسالة خطأ */}
                {error && (
                  <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    ⚠️ {error}
                  </div>
                )}
                
                {/* عداد الأحرف */}
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={word.length > 25 ? 'text-orange-400' : 'text-slate-400'}>
                    {word.length}/30 حرف
                  </span>
                  {word.length >= 2 && word.length <= 30 && !error && (
                    <span className="text-green-400">✓ جاهزة للإرسال</span>
                  )}
                </div>
              </div>

              {/* إرشادات */}
              <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-xs text-blue-300 text-center">
                  💡 اختر كلمة واضحة وليست صعبة جداً!
                  <br />
                  يجب أن تكون الكلمة بالعربية فقط (2-30 حرف)
                </p>
              </div>

              {/* زر الإرسال */}
              <button
                type="submit"
                disabled={!word.trim() || isSubmitting || error}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg disabled:cursor-not-allowed"
              >
                {isSubmitting ? '⏳ جاري الإرسال...' : '✅ إرسال الكلمة'}
              </button>
            </form>
          ) : (
            <div className="text-center">
              {/* رسالة النجاح */}
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  تم إرسال كلمتك!
                </h3>
                <p className="text-sm text-green-300">
                  في انتظار باقي اللاعبين...
                </p>
              </div>

              {/* معلومة إضافية */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl mb-4">
                <p className="text-xs text-purple-300">
                  {readyCount === totalPlayers && totalPlayers > 0 ? (
                    <>🎮 اللعبة تبدأ بعد قليل...</>
                  ) : (
                    <>💡 ستبدأ اللعبة تلقائياً عندما يرسل جميع اللاعبين كلماتهم</>
                  )}
                </p>
              </div>

              {/* زر إعادة المحاولة */}
              {readyCount === totalPlayers && totalPlayers > 0 ? (
                // ✅ إذا اكتمل العداد - لا يمكن التعديل
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <p className="text-xs text-orange-300">
                    ⚠️ لا يمكن تعديل الكلمة الآن - اللعبة بدأت!
                  </p>
                </div>
              ) : (
                // ✅ إذا لم يكتمل - يمكن التعديل
                <button
                  onClick={handleRetry}
                  className="text-sm text-purple-300 hover:text-white underline"
                >
                  هل تريد تغيير كلمتك؟
                </button>
              )}
            </div>
          )}
        </div>

        {/* نصائح إضافية */}
        <div className="mt-6 space-y-2">
          <div className="bg-slate-800/30 backdrop-blur-xl rounded-xl p-3 border border-purple-500/10">
            <p className="text-xs text-purple-300 text-center">
              ✨ كلمات جيدة: قطة، سيارة، شجرة، شمس
            </p>
          </div>
          <div className="bg-slate-800/30 backdrop-blur-xl rounded-xl p-3 border border-red-500/10">
            <p className="text-xs text-red-300 text-center">
              ❌ تجنب: كلمات معقدة، أسماء علم، كلمات غير واضحة
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrawingWordsInput;