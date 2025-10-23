    import { useState, useEffect, useRef } from 'react';
    import { useLocation, useNavigate } from 'react-router-dom';
    import socketService from '../services/socket';

    function DrawingGame() {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, playerName } = location.state || {};
    const [notifications, setNotifications] = useState([]);
    const [isRestoringCanvas, setIsRestoringCanvas] = useState(false);

    const [isDrawing, setIsDrawing] = useState(false);
    const [myTurn, setMyTurn] = useState(false);
    const [currentWord, setCurrentWord] = useState('');
    const [drawerName, setDrawerName] = useState('');
    const [timeLeft, setTimeLeft] = useState(60);
    const [round, setRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(1);
    const [guess, setGuess] = useState('');
    const [scores, setScores] = useState([]);
    const [messages, setMessages] = useState([]);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(3);
    const [isEraser, setIsEraser] = useState(false); // ✅ حالة الممحاة
    const [remainingGuesses, setRemainingGuesses] = useState(5);
    const [showScores, setShowScores] = useState(false);
    const [gameEnded, setGameEnded] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const timerRef = useRef(null);

    const colors = ['#000000', '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'];

    // ✅ إعداد Canvas محسّن
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;


        

        const updateCanvasSize = () => {
        const container = canvas.parentElement;
        
        // ✅ حساب الحجم المناسب للشاشة
        const containerWidth = container.offsetWidth;
        const maxHeight = window.innerHeight * 0.6; // 60% من ارتفاع الشاشة
        const aspectRatio = 4 / 3; // نسبة 4:3
        
        let canvasWidth = containerWidth;
        let canvasHeight = canvasWidth / aspectRatio;
        
        // إذا كان الارتفاع أكبر من المسموح
        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); // ✅ تحسين الأداء
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctxRef.current = ctx;
        };

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        
        return () => window.removeEventListener('resize', updateCanvasSize);
    }, []);

    // Socket Events
    useEffect(() => {
    if (!roomId || !playerName) {
        navigate('/');
        return;
    }

    const socket = socketService.connect();
    socketService.setRoomInfo(roomId, playerName);

            // ✅✅✅ تسجيل جميع الـ listeners أولاً قبل join-room
    
    
            // ✅ استقبال Canvas المحفوظة
        socket.on('restore-canvas', (data) => {
        console.log('🎨 استقبال الرسومات:', data.drawings?.length || 0);
        
        if (!data.drawings || data.drawings.length === 0) {
            console.log('⚠️ لا توجد رسومات للاستعادة');
            return;
        }

        // ✅ تفعيل وضع الاستعادة
        setIsRestoringCanvas(true)

            // ✅ دالة لإعادة الرسم
        const restoreDrawings = () => {
            if (!ctxRef.current || !canvasRef.current) {
            console.log('⚠️ Canvas غير جاهزة - إعادة المحاولة...');
            setTimeout(restoreDrawings, 50);
            return;
            }
        
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        
        // مسح Canvas
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
            console.log('🖌️ بدء إعادة رسم', data.drawings.length, 'خط');
            
            // إعادة رسم كل الرسومات
            data.drawings.forEach((drawData) => {
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
            
            console.log('✅ تم استعادة الرسومات بنجاح');
            
            // ✅ إيقاف وضع الاستعادة بعد 500ms
            setTimeout(() => {
            setIsRestoringCanvas(false);
            }, 500);
        };

        // ✅ بدء عملية الاستعادة
        restoreDrawings();
        });

        socket.on('your-turn-to-draw', (data) => {
        console.log('🎨 دورك للرسم:', data);
        
        setMyTurn(true);
        setCurrentWord(data.word);
        setRound(data.round);
        setTotalRounds(data.totalRounds);
        
        const initialTime = data.timeLeft !== undefined ? data.timeLeft : 60;
        console.log('⏱️ الوقت المتبقي:', initialTime);
        setTimeLeft(initialTime);
        
        setMessages([]);
        setRemainingGuesses(5);
        setIsEraser(false);
        
        // ✅ لا تمسح Canvas إذا كانت إعادة انضمام أو في وضع الاستعادة
        if (!data.isRejoining && !isRestoringCanvas) {
            console.log('🗑️ مسح Canvas - جولة جديدة');
            clearCanvas();
        } else {
            console.log('♻️ إعادة انضمام - Canvas محفوظة');
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
        });

        socket.on('someone-drawing', (data) => {
        console.log('👀 شخص يرسم:', data);
        
        setMyTurn(false);
        setDrawerName(data.drawerName);
        setRound(data.round);
        setTotalRounds(data.totalRounds);
        
        const initialTime = data.timeLeft !== undefined ? data.timeLeft : 60;
        console.log('⏱️ الوقت المتبقي:', initialTime);
        setTimeLeft(initialTime);
        
        setMessages([]);
        setRemainingGuesses(5);
        
        // ✅ لا تمسح Canvas إذا كانت إعادة انضمام أو في وضع الاستعادة
        if (!data.isRejoining && !isRestoringCanvas) {
            console.log('🗑️ مسح Canvas - جولة جديدة');
            clearCanvas();
        } else {
            console.log('♻️ إعادة انضمام - Canvas محفوظة');
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
        })

    socket.on('player-rejoined', (data) => {
        setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: `🔄 ${data.playerName} عاد للعبة`
        }]);
        
        setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== Date.now()));
        }, 3000);
    });

    socket.on('player-disconnected', (data) => {
        setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'warning',
        message: `⚠️ ${data.playerName} انقطع اتصاله`
        }]);
        
        setTimeout(() => {
        setNotifications(prev => prev.slice(0, -1));
        }, 3000);
    });

    socket.on('player-left-permanently', (data) => {
        setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `❌ ${data.playerName} غادر اللعبة`
        }]);
        
        setTimeout(() => {
        setNotifications(prev => prev.slice(0, -1));
        }, 3000);
    });

    socket.on('drawing', (data) => {
        if (!ctxRef.current) return;
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        
        const x = data.x * canvas.width;
        const y = data.y * canvas.height;

        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.brushSize;
        
        if (data.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        } else {
        ctx.globalCompositeOperation = 'source-over';
        }

        if (data.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        } else if (data.type === 'draw') {
        ctx.lineTo(x, y);
        ctx.stroke();
        }
    });

    socket.on('canvas-cleared', () => {
        clearCanvas();
    });

    socket.on('correct-guess', (data) => {
        setMessages(prev => [{
        type: 'correct',
        playerName: data.playerName,
        message: '✅ خمّن الكلمة بشكل صحيح!',
        id: Date.now()
        }, ...prev]);

        setScores(data.scores.sort((a, b) => b.score - a.score));
    });

    socket.on('wrong-guess', (data) => {
        setMessages(prev => [{
        type: 'wrong',
        playerName: data.playerName,
        message: data.guess,
        id: Date.now()
        }, ...prev.slice(0, 9)]);
    });

    socket.on('guesses-update', (data) => {
        console.log('📊 تحديث المحاولات:', data.remainingGuesses);
        setRemainingGuesses(data.remainingGuesses);
    });

    socket.on('no-guesses-left', (data) => {
        setMessages(prev => [{
        type: 'error',
        message: data.message,
        id: Date.now()
        }, ...prev]);
    });

    socket.on('round-ended', (data) => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        setMessages(prev => [{
        type: 'info',
        message: `الكلمة كانت: ${data.word}`,
        id: Date.now()
        }, ...prev]);

        setScores(data.scores.sort((a, b) => b.score - a.score));
    });

    socket.on('scores-update', (data) => {
        console.log('📊 تحديث النقاط:', data.scores);
        setScores(data.scores.sort((a, b) => b.score - a.score));
    });

    socket.on('game-finished', (data) => {
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
    });

    // ✅ listener لإعادة الانضمام عند reconnect
    const handleReconnect = () => {
        console.log('🔄 إعادة الاتصال - الانضمام للغرفة مرة أخرى');
        socket.emit('join-room', { roomId, playerName });
        socket.emit('get-scores', { roomId });
        socket.emit('request-drawing-state', { roomId });
    };

    socket.on('connect', handleReconnect);

    // ✅✅✅ الآن بعد تسجيل كل الـ listeners، نرسل join-room
    console.log(`📡 الانضمام للغرفة ${roomId} باسم ${playerName}`);
    socket.emit('join-room', { roomId, playerName });
    socket.emit('get-scores', { roomId });
    socket.emit('request-drawing-state', { roomId });

    return () => {
        socket.off('connect', handleReconnect);
        socket.off('restore-canvas');
        socket.off('player-rejoined');
        socket.off('player-disconnected');
        socket.off('player-left-permanently');
        socket.off('your-turn-to-draw');
        socket.off('someone-drawing');
        socket.off('drawing');
        socket.off('canvas-cleared');
        socket.off('correct-guess');
        socket.off('wrong-guess');
        socket.off('guesses-update');
        socket.off('no-guesses-left');
        socket.off('round-ended');
        socket.off('scores-update');
        socket.off('game-finished');
        if (timerRef.current) clearInterval(timerRef.current);
    };
    }, [roomId, playerName, navigate, isNavigating, isRestoringCanvas]);

    // ✅ دوال الرسم المحسّنة
    const getCanvasCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // ✅ الحصول على الإحداثيات الصحيحة
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;
        
        // ✅ تحويل الإحداثيات مع مراعاة scale
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        return { x, y };
    };

    const startDrawing = (e) => {
        if (!myTurn) return;
        
        e.preventDefault();
        
        const { x, y } = getCanvasCoordinates(e);
        const canvas = canvasRef.current;

        setIsDrawing(true);
        
        const ctx = ctxRef.current;
        
        // ✅ تطبيق الممحاة
        if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = brushSize * 3; // الممحاة أكبر
        } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        }
        
        ctx.beginPath();
        ctx.moveTo(x, y);

        // ✅ إرسال إحداثيات نسبية (0-1)
        socketService.emit('draw', {
        roomId,
        drawData: { 
            type: 'start', 
            x: x / canvas.width, 
            y: y / canvas.height, 
            color, 
            brushSize,
            isEraser
        }
        });
    };

    const draw = (e) => {
        if (!isDrawing || !myTurn) return;

        e.preventDefault();
        
        const { x, y } = getCanvasCoordinates(e);
        const canvas = canvasRef.current;

        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();

        // ✅ إرسال إحداثيات نسبية
        socketService.emit('draw', {
        roomId,
        drawData: { 
            type: 'draw', 
            x: x / canvas.width, 
            y: y / canvas.height, 
            color, 
            brushSize,
            isEraser
        }
        });
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleClear = () => {
        if (!myTurn) return;
        clearCanvas();
        socketService.emit('clear-canvas', { roomId });
    };

    // ✅ تبديل الممحاة
    const toggleEraser = () => {
        setIsEraser(!isEraser);
    };

    const handleGuess = (e) => {
        e.preventDefault();
        if (!guess.trim() || myTurn || remainingGuesses <= 0) return;

        socketService.emit('submit-guess', { guess: guess.trim() });
        setGuess('');
    };

        const handleConfirmLeave = () => {
            setGameEnded(true);
            setShowLeaveConfirm(false);
            
            socketService.emit('player-leave', { roomId, playerName });
            
            // ✅ مسح معلومات الغرفة قبل قطع الاتصال
            socketService.clearRoomInfo();
            socketService.disconnect();
            
            navigate('/');
        };

    return (
        <div className="min-h-screen w-full p-2 sm:p-4">
        
        {/* ✅ الإشعارات */}
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
            {/* زر المغادرة - responsive */}
                <div className="fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-40">
                <button
                    onClick={() => setShowLeaveConfirm(true)}
                    className="bg-gradient-to-br from-red-500/90 to-rose-600/90 backdrop-blur-xl text-white p-3 sm:px-5 sm:py-3 rounded-2xl font-bold hover:from-red-600 hover:to-rose-700 shadow-xl shadow-red-500/20 border border-red-400/30 transition-all duration-300 hover:scale-105 active:scale-95"
                >
                    <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-xl">🚪</span>
                    <span className="hidden sm:inline text-base">مغادرة</span>
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
                    إذا غادرت الآن سيتم فقدان تقدمك في اللعبة.
                </p>
                </div>
                
                <div className="flex gap-3">
                <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg text-sm sm:text-base"
                >
                    ✅ البقاء
                </button>
                <button
                    onClick={handleConfirmLeave}
                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg text-sm sm:text-base"
                >   
                    🚪 مغادرة
                </button>
                </div>
            </div>
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
                    <span className="text-lg font-bold text-pink-400">
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

        <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            
            {/* القسم الرئيسي */}
            <div className="lg:col-span-2">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-3 sm:p-6 border border-purple-500/20 shadow-2xl">
                {/* رأس اللعبة */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex-1">
                    <h2 className="text-base sm:text-xl font-bold text-white">
                        {myTurn ? (
                        <>🎨 دورك: <span className="text-pink-400">{currentWord}</span></>
                        ) : (
                        <>👀 يرسم: <span className="text-pink-400">{drawerName}</span></>
                        )}
                    </h2>
                    <p className="text-xs sm:text-sm text-purple-300">
                        الجولة {round} من {totalRounds}
                    </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                    <div className={`text-xl sm:text-3xl font-bold ${
                        timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-green-400'
                    }`}>
                        ⏱️ {timeLeft}
                    </div>
                    
                    <button
                        onClick={() => setShowScores(true)}
                        className="lg:hidden bg-purple-600/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg font-bold text-sm border border-purple-500/50"
                    >
                        📊
                    </button>
                    </div>
                </div>

                {/* أدوات الرسم */}
                {myTurn && (
                    <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-slate-700/50 rounded-xl overflow-x-auto border border-purple-500/20">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-max">
                        {/* الألوان */}
                        <div className="flex gap-1 sm:gap-2">
                        {colors.map(c => (
                            <button
                            key={c}
                            onClick={() => {
                                setColor(c);
                                setIsEraser(false); // ✅ إيقاف الممحاة عند اختيار لون
                            }}
                            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition-all ${
                                color === c && !isEraser
                                ? 'border-purple-400 scale-110 shadow-lg shadow-purple-500/50' 
                                : 'border-slate-500 hover:border-purple-400/50'
                            }`}
                            style={{ backgroundColor: c }}
                            />
                        ))}
                        </div>

                        {/* حجم القلم */}
                        <div className="flex gap-1 sm:gap-2 border-r border-l border-purple-500/30 px-2 sm:px-3">
                        {[2, 5, 10].map(size => (
                            <button
                            key={size}
                            onClick={() => setBrushSize(size)}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
                                brushSize === size 
                                ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg' 
                                : 'bg-slate-600/50 text-slate-300 hover:bg-slate-600'
                            }`}
                            >
                            <div 
                                className="rounded-full bg-current" 
                                style={{ width: size + 2, height: size + 2 }}
                            />
                            </button>
                        ))}
                        </div>

                        {/* ✅ زر الممحاة */}
                        <button
                        onClick={toggleEraser}
                        className={`px-3 py-2 sm:px-4 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap shadow-lg transition-all ${
                            isEraser
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                            : 'bg-slate-600/50 text-slate-300 hover:bg-slate-600'
                        }`}
                        >
                        🧽 ممحاة
                        </button>

                        {/* مسح */}
                        <button
                        onClick={handleClear}
                        className="px-3 py-2 sm:px-4 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg hover:from-red-600 hover:to-rose-600 font-semibold text-xs sm:text-sm whitespace-nowrap shadow-lg"
                        >
                        🗑️ مسح
                        </button>
                    </div>
                    </div>
                )}

                {/* ✅ لوحة الرسم محسّنة */}
                <div className="flex justify-center">
                    <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className={`max-w-full border-4 border-purple-500/30 rounded-xl bg-white shadow-xl ${
                        myTurn ? (isEraser ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-not-allowed'
                    } touch-none`}
                    style={{ 
                        display: 'block',
                        maxHeight: '70vh' // ✅ حد أقصى للارتفاع
                    }}
                    />
                </div>

                {/* حقل التخمين */}
                {!myTurn && (
                    <div className="mt-3 sm:mt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs sm:text-sm font-semibold text-purple-200">
                        المحاولات المتبقية:
                        </span>
                        <span className={`text-base sm:text-lg font-bold ${
                        remainingGuesses <= 2 ? 'text-red-400' : 'text-green-400'
                        }`}>
                        {remainingGuesses} / 5
                        </span>
                    </div>
                    <form onSubmit={handleGuess}>
                        <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            placeholder={remainingGuesses > 0 ? "اكتب تخمينك..." : "لا محاولات!"}
                            className="flex-1 px-4 md:px-6 py-3 bg-slate-700/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-base sm:text-lg"
                            disabled={remainingGuesses <= 0}
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!guess.trim() || remainingGuesses <= 0}
                            className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-700 text-white px-4 sm:px-6 py-3 rounded-xl font-semibold disabled:cursor-not-allowed shadow-lg text-sm sm:text-base whitespace-nowrap"
                        >
                            📤 إرسال
                        </button>
                        </div>
                    </form>
                    </div>
                )}
                </div>

                {/* الرسائل - للجوال */}
                {messages.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-3 sm:p-6 mt-3 sm:mt-4 lg:hidden border border-purple-500/20 shadow-2xl">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 text-center">
                    💬 التخمينات
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollable">
                    {messages.map((msg) => (
                        <div
                        key={msg.id}
                        className={`p-2 sm:p-3 rounded-lg text-sm border ${
                            msg.type === 'correct' ? 'bg-green-500/20 border-green-500/30' :
                            msg.type === 'info' ? 'bg-blue-500/20 border-blue-500/30' :
                            msg.type === 'error' ? 'bg-red-500/20 border-red-500/30' :
                            'bg-slate-700/30 border-slate-600/30'
                        }`}
                        >
                        {msg.type === 'correct' ? (
                            <div className="flex items-center justify-between">
                            <span className="font-semibold text-green-300">
                                👤 {msg.playerName}
                            </span>
                            <span className="text-green-400 font-bold">✅</span>
                            </div>
                        ) : msg.type === 'info' ? (
                            <p className="text-center font-bold text-blue-300">
                            {msg.message}
                            </p>
                        ) : msg.type === 'error' ? (
                            <p className="text-center font-bold text-red-300">
                            ⚠️ {msg.message}
                            </p>
                        ) : (
                            <div>
                            <span className="font-semibold text-purple-200">
                                👤 {msg.playerName}:
                            </span>
                            <span className="text-slate-300 ml-2">{msg.message}</span>
                            </div>
                        )}
                        </div>
                    ))}
                    </div>
                </div>
                )}
            </div>

            {/* الشريط الجانبي - للكمبيوتر فقط */}
            <div className="hidden lg:block space-y-4">
                {/* النقاط */}
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/20 shadow-2xl sticky top-4">
                <h3 className="text-lg font-bold text-white mb-3 text-center">
                    📊 النقاط
                </h3>
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
                        <span className="font-semibold text-white">{player.name}</span>
                        </div>
                        <span className="text-xl font-bold text-pink-400">
                        {player.score}
                        </span>
                    </div>
                    ))}
                </div>
                </div>

                {/* الرسائل */}
                {messages.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border-purple-500/20 shadow-2xl">
                    <h3 className="text-lg font-bold text-white mb-3 text-center">
                    💬 التخمينات
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto scrollable">
                    {messages.map((msg) => (
                        <div
                        key={msg.id}
                        className={`p-3 rounded-lg border ${
                            msg.type === 'correct' ? 'bg-green-500/20 border-green-500/30' :
                            msg.type === 'info' ? 'bg-blue-500/20 border-blue-500/30' :
                            msg.type === 'error' ? 'bg-red-500/20 border-red-500/30' :
                            'bg-slate-700/30 border-slate-600/30'
                        }`}
                        >
                        {msg.type === 'correct' ? (
                            <div className="flex items-center justify-between">
                            <span className="font-semibold text-green-300">
                                👤 {msg.playerName}
                            </span>
                            <span className="text-green-400 font-bold">✅</span>
                            </div>
                        ) : msg.type === 'info' ? (
                            <p className="text-center font-bold text-blue-300">
                            {msg.message}
                            </p>
                        ) : msg.type === 'error' ? (
                            <p className="text-center font-bold text-red-300">
                            ⚠️ {msg.message}
                            </p>
                        ) : (
                            <div>
                            <span className="font-semibold text-purple-200">
                                👤 {msg.playerName}:
                            </span>
                            <span className="text-slate-300 ml-2">{msg.message}</span>
                            </div>
                        )}
                        </div>
                    ))}
                    </div>
                </div>
                )}
            </div>
            </div>
        </div>
        </div>
    );
    }

    export default DrawingGame;