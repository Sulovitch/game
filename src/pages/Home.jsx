import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [step, setStep] = useState('name');
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // ✅ حالة جديدة للاسم المكرر
  const [duplicateName, setDuplicateName] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  
  const navigate = useNavigate();

  const API_URL = 'http://192.168.1.142:3000/api';

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('الرجاء إدخال اسمك');
      return;
    }
    setError('');
    setStep('action');
  };

  const handleCreateRoom = async () => {
    if (!selectedGame) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/game/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          gameType: selectedGame
        })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);

      navigate('/lobby', { 
        state: { 
          roomId: data.roomId, 
          playerName: playerName.trim(), 
          gameType: selectedGame, 
          isHost: true 
        } 
      });
    } catch (err) {
      setError(err.message || 'حدث خطأ في إنشاء الغرفة');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      setError('الرجاء إدخال رمز الغرفة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/game/join/${roomId.trim().toUpperCase()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName.trim() })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // ✅ التحقق إذا كان الخطأ بسبب اسم مكرر
        if (data.error && data.error.includes('مستخدم بالفعل')) {
          setDuplicateName(true);
          setNewPlayerName(playerName.trim());
          setError('');
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      navigate('/lobby', { 
        state: { 
          roomId: roomId.trim().toUpperCase(), 
          playerName: playerName.trim(), 
          gameType: data.gameType,
          isHost: false 
        } 
      });
    } catch (err) {
      setError(err.message || 'حدث خطأ في الانضمام للغرفة');
    } finally {
      setLoading(false);
    }
  };

  // ✅ دالة لإعادة محاولة الانضمام باسم جديد
  const handleRetryWithNewName = async () => {
    if (!newPlayerName.trim()) {
      setError('الرجاء إدخال اسم جديد');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/game/join/${roomId.trim().toUpperCase()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: newPlayerName.trim() })
      });

      const data = await response.json();
      
      if (!response.ok) {
        // إذا كان الاسم الجديد أيضاً مكرر
        if (data.error && data.error.includes('مستخدم بالفعل')) {
          setError('هذا الاسم أيضاً مستخدم! جرب اسماً آخر');
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      // ✅ نجحت! حدّث اسم اللاعب الأساسي
      setPlayerName(newPlayerName.trim());
      
      navigate('/lobby', { 
        state: { 
          roomId: roomId.trim().toUpperCase(), 
          playerName: newPlayerName.trim(), 
          gameType: data.gameType,
          isHost: false 
        } 
      });
    } catch (err) {
      setError(err.message || 'حدث خطأ في الانضمام للغرفة');
    } finally {
      setLoading(false);
    }
  };

  // ✅ دالة للرجوع من شاشة تغيير الاسم
  const handleCancelNameChange = () => {
    setDuplicateName(false);
    setNewPlayerName('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 py-8 md:py-12">
      <div className="w-full max-w-md">
        
        {/* Step 1: Name Input */}
        {step === 'name' && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
            <div className="text-center mb-6 md:mb-8">
              <div className="inline-block p-3 md:p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-3 md:mb-4">
                <span className="text-4xl md:text-5xl">🎮</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                مرحباً بك!
              </h1>
              <p className="text-purple-300 text-sm md:text-base">
                ابدأ بإدخال اسمك
              </p>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-4">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اسمك"
                className="w-full px-4 md:px-6 py-3 md:py-4 bg-slate-700/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-center text-base md:text-lg"
                maxLength={20}
                autoFocus
              />

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!playerName.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3 md:py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/50 disabled:shadow-none"
              >
                التالي
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Action Selection */}
        {step === 'action' && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
            <div className="text-center mb-6 md:mb-8">
              <div className="inline-block p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl mb-3">
                <span className="text-3xl md:text-4xl">👋</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                أهلاً {playerName}!
              </h2>
              <p className="text-purple-300 text-sm md:text-base">
                ماذا تريد أن تفعل؟
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setStep('create')}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-4 md:py-5 px-6 rounded-xl transition-all shadow-lg hover:shadow-green-500/50 hover:scale-105"
              >
                <div className="text-2xl md:text-3xl mb-1">➕</div>
                <div className="text-base md:text-lg">إنشاء لعبة جديدة</div>
              </button>

              <button
                onClick={() => setStep('join')}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-4 md:py-5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/50 hover:scale-105"
              >
                <div className="text-2xl md:text-3xl mb-1">🚪</div>
                <div className="text-base md:text-lg">الانضمام لغرفة</div>
              </button>

              <button
                onClick={() => {
                  setStep('name');
                  setError('');
                }}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-xl transition-all"
              >
                ← رجوع
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Create Game */}
        {step === 'create' && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
            <div className="text-center mb-5 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                اختر نوع اللعبة
              </h2>
              <p className="text-purple-300 text-xs md:text-sm">
                اختر اللعبة التي تريد لعبها مع أصدقائك
              </p>
            </div>

            <div className="space-y-3 mb-5 md:mb-6">
              <button
                onClick={() => setSelectedGame('drawing')}
                className={`w-full p-5 md:p-6 rounded-2xl border-2 transition-all ${
                  selectedGame === 'drawing'
                    ? 'bg-gradient-to-br from-pink-600 to-rose-600 border-pink-500 shadow-lg shadow-pink-500/50 scale-105'
                    : 'bg-slate-700/30 border-slate-600/50 hover:border-pink-500/50 hover:bg-slate-700/50'
                }`}
              >
                <div className="text-4xl md:text-5xl mb-2 md:mb-3">🎨</div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-1 md:mb-2">ارسم وخمّن</h3>
                <p className="text-xs md:text-sm text-slate-300">
                  ارسم الكلمة وخلي أصدقائك يخمنونها
                </p>
              </button>

              <button
                onClick={() => setSelectedGame('categories')}
                className={`w-full p-5 md:p-6 rounded-2xl border-2 transition-all ${
                  selectedGame === 'categories'
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 border-purple-500 shadow-lg shadow-purple-500/50 scale-105'
                    : 'bg-slate-700/30 border-slate-600/50 hover:border-purple-500/50 hover:bg-slate-700/50'
                }`}
              >
                <div className="text-4xl md:text-5xl mb-2 md:mb-3">⚡</div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-1 md:mb-2">سباق الفئات</h3>
                <p className="text-xs md:text-sm text-slate-300">
                  اكتب كلمات من فئات مختلفة بأسرع وقت
                </p>
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm text-center mb-4">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCreateRoom}
                disabled={!selectedGame || loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3 md:py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/50"
              >
                {loading ? '⏳ جاري الإنشاء...' : '🎮 إنشاء الغرفة'}
              </button>

              <button
                onClick={() => {
                  setStep('action');
                  setSelectedGame(null);
                  setError('');
                }}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-xl transition-all"
              >
                ← رجوع
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Join Room */}
        {step === 'join' && !duplicateName && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
            <div className="text-center mb-5 md:mb-6">
              <div className="inline-block p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl mb-3">
                <span className="text-3xl md:text-4xl">🚪</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                الانضمام لغرفة
              </h2>
              <p className="text-purple-300 text-xs md:text-sm">
                أدخل رمز الغرفة للانضمام
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="رمز الغرفة (مثال: ABC123)"
                className="w-full px-4 md:px-6 py-3 md:py-4 bg-slate-700/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-center text-base md:text-lg font-mono tracking-widest"
                maxLength={6}
                autoFocus
              />

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleJoinRoom}
                disabled={!roomId.trim() || loading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3 md:py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/50"
              >
                {loading ? '⏳ جاري الانضمام...' : '🚀 انضمام'}
              </button>

              <button
                onClick={() => {
                  setStep('action');
                  setRoomId('');
                  setError('');
                }}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-xl transition-all"
              >
                ← رجوع
              </button>
            </div>
          </div>
        )}

        {/* ✅✅✅ Step 5: Change Duplicate Name ✅✅✅ */}
        {step === 'join' && duplicateName && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-yellow-500/30 shadow-2xl">
            <div className="text-center mb-5 md:mb-6">
              <div className="inline-block p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl mb-3 animate-pulse">
                <span className="text-3xl md:text-4xl">⚠️</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                الاسم مستخدم بالفعل!
              </h2>
              <p className="text-yellow-300 text-xs md:text-sm">
                يوجد لاعب في الغرفة باسم "<span className="font-bold">{playerName}</span>"
              </p>
              <p className="text-purple-300 text-xs md:text-sm mt-2">
                الرجاء اختيار اسم آخر للانضمام
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-purple-200 font-semibold mb-2 text-sm">
                  اسمك الجديد:
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="اختر اسماً جديداً"
                  className="w-full px-4 md:px-6 py-3 md:py-4 bg-slate-700/50 border border-yellow-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all text-center text-base md:text-lg"
                  maxLength={20}
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}

              <button
                onClick={handleRetryWithNewName}
                disabled={!newPlayerName.trim() || loading}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold py-3 md:py-4 px-6 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-yellow-500/50"
              >
                {loading ? '⏳ جاري المحاولة...' : '✅ انضمام باسم جديد'}
              </button>

              <button
                onClick={handleCancelNameChange}
                className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-6 rounded-xl transition-all"
              >
                ← رجوع
              </button>
            </div>

            {/* نصائح */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="text-center text-xs md:text-sm text-purple-300 space-y-2">
                <p>💡 جرب إضافة رقم لاسمك (مثال: {playerName}2)</p>
                <p>✨ أو استخدم اسماً مختلفاً تماماً</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Home;