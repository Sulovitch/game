const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/typing-game')
.then(() => console.log('✅ MongoDB متصل'))
.catch(err => console.log('❌ خطأ في الاتصال بـ MongoDB:', err));

// Models
const GameResult = mongoose.model('GameResult', {
  playerName: String,
  wpm: Number,
  accuracy: Number,
  date: { type: Date, default: Date.now }
});

// متغيرات اللعبة
const rooms = new Map();

// قوائم الفئات
const categories = {
  animals: [
    'قط', 'كلب', 'أسد', 'فيل', 'نمر', 'دب', 'ذئب', 'ثعلب', 'أرنب', 'غزال', 
    'زرافة', 'حمار', 'حصان', 'جمل', 'بقرة', 'خروف', 'ماعز', 'دجاجة', 'بطة', 'إوزة',
    'نسر', 'صقر', 'حمامة', 'عصفور', 'ببغاء', 'سمكة', 'قرش', 'حوت', 'دولفين', 'أخطبوط',
    'فأر', 'قنفذ', 'سلحفاة', 'ثعبان', 'تمساح', 'ضفدع', 'نحلة', 'نملة', 'فراشة', 'عنكبوت',
    'خفاش', 'كنغر', 'باندا', 'قرد', 'غوريلا', 'فهد', 'ضبع', 'وحيد القرن', 'فرس النهر', 'دودة'
  ],
  fruits: [
    'تفاح', 'موز', 'برتقال', 'عنب', 'فراولة', 'مانجو', 'أناناس', 'بطيخ', 'شمام', 'خوخ',
    'كمثرى', 'ليمون', 'رمان', 'كيوي', 'تين', 'توت', 'مشمش', 'جوافة', 'باباي', 'تمر',
    'كرز', 'بلح', 'يوسفي', 'جريب فروت', 'خوخ', 'دراق', 'نكتارين', 'جوز الهند', 'أفوكادو', 'تنين',
    'باشن فروت', 'ليتشي', 'رامبوتان', 'كاكا', 'كمكوات', 'بلوبيري', 'راسبيري', 'بلاك بيري', 'فريز', 'سفرجل',
    'نبق', 'عناب', 'دوم', 'بوملي', 'يد بوذا', 'اكي', 'كورسول', 'دوريان', 'مانجوستين', 'لونجان'
  ],
  math: []
};

const categoryInfo = [
  { id: 'animals', name: 'حيوانات', icon: '🐱', duration: 20 },
  { id: 'fruits', name: 'فواكه', icon: '🍎', duration: 20 },
  { id: 'math', name: 'عمليات حسابية', icon: '➗', duration: 20 }
];

const randomWords = [
  'سيارة', 'شجرة', 'قطة', 'كلب', 'بيت', 'شمس', 'قمر', 'نجمة', 'زهرة', 'سمكة',
  'طائرة', 'قارب', 'دراجة', 'كرة', 'كتاب', 'قلم', 'كوب', 'طاولة', 'كرسي', 'باب',
  'شباك', 'ساعة', 'هاتف', 'حاسوب', 'تلفاز', 'نظارة', 'قبعة', 'حذاء', 'قميص', 'سروال',
  'فراشة', 'نحلة', 'عصفور', 'أرنب', 'فيل', 'أسد', 'نمر', 'دب', 'ثعلب', 'غزال',
  'تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'جبل', 'نهر', 'بحر', 'سحابة', 'مطر'
];

function normalizeText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/ة/g, 'ه')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/\s+/g, ' ');
}

function generateMathQuestion() {
  const operations = ['+', '-', '×', '÷'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let num1, num2, answer;
  
  if (operation === '+') {
    num1 = Math.floor(Math.random() * 50) + 1;
    num2 = Math.floor(Math.random() * 50) + 1;
    answer = num1 + num2;
  } else if (operation === '-') {
    num1 = Math.floor(Math.random() * 50) + 20;
    num2 = Math.floor(Math.random() * num1) + 1;
    answer = num1 - num2;
  } else if (operation === '×') {
    num1 = Math.floor(Math.random() * 12) + 1;
    num2 = Math.floor(Math.random() * 12) + 1;
    answer = num1 * num2;
  } else {
    num2 = Math.floor(Math.random() * 10) + 2;
    answer = Math.floor(Math.random() * 10) + 1;
    num1 = num2 * answer;
  }
  
  return {
    question: `${num1} ${operation} ${num2}`,
    answer: answer
  };
}

// ✅ دالة محسّنة لنقل الهوست
function transferHost(room) {
  if (!room || room.players.length === 0) {
    console.log('❌ لا يمكن نقل الهوست - لا يوجد لاعبين');
    return false;
  }
  
  const oldHost = room.hostName;
  
  // ✅ البحث عن لاعب متصل (id !== null) وليس في وضع الانقطاع
  const connectedPlayers = room.players.filter(p => 
    p.id !== null && 
    !p.disconnectTimeout // ✅ ليس في فترة الانتظار للمغادرة
  );
  
  if (connectedPlayers.length === 0) {
    console.log('❌ لا يوجد لاعبين متصلين لنقل الهوست إليهم');
    return false;
  }
  
  // ✅ اختيار أول لاعب متصل ليصبح الهوست
  const newHost = connectedPlayers[0];
  
  room.hostName = newHost.name;
  console.log(`👑 تم نقل الهوست من ${oldHost} إلى ${newHost.name}`);
  
  return true;
}

// ✅ دالة لحساب الوقت المتبقي بدقة
function calculateTimeLeft(startTime, duration) {
  if (!startTime) return duration;
  
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);
  const remaining = Math.max(0, duration - elapsed);
  
  return remaining;
}

// ✅ دالة لمزامنة الوقت مع جميع اللاعبين
function syncTimeWithClients(roomId, room, eventName, additionalData = {}) {
  if (!room.categoryStartTime && !room.roundStartTime) return;
  
  const startTime = room.categoryStartTime || room.roundStartTime;
  const duration = room.gameType === 'drawing' ? 60 : 
                   (room.currentCategory < categoryInfo.length ? 
                    categoryInfo[room.currentCategory].duration : 20);
  
  const timeLeft = calculateTimeLeft(startTime, duration);
  
  io.to(roomId).emit(eventName, {
    ...additionalData,
    timeLeft,
    serverTime: Date.now() // ✅ إرسال وقت السيرفر للمزامنة
  });
}

// ================ API Endpoints ================

app.post('/api/game/create', (req, res) => {
  const { playerName, gameType } = req.body;
  
  if (!playerName) {
    return res.status(400).json({ error: 'اسم اللاعب مطلوب' });
  }

  const roomId = generateRoomId();
  
  const roomData = {
    players: [{
      id: null,
      name: playerName,
      score: 0,
      answers: [],
      remainingGuesses: 5,
      lastUpdateTime: Date.now() // ✅ تتبع آخر تحديث
    }],
    status: 'waiting',
    gameType: gameType || 'categories',
    createdAt: Date.now(),
    hostName: playerName
  };

  if (gameType === 'drawing') {
    roomData.drawingWords = [];
    roomData.currentRound = 0;
    roomData.currentDrawer = 0;
    roomData.guessedPlayers = [];
    roomData.wordMode = 'player';
    roomData.canvasDrawings = [];
  } else {
    roomData.currentCategory = 0;
    roomData.usedAnswers = [];
  }
  
  rooms.set(roomId, roomData);

  console.log(`✅ تم إنشاء غرفة ${roomId} - النوع: ${gameType} - المضيف: ${playerName}`);

  res.json({ 
    roomId,
    gameType: gameType || 'categories',
    message: 'تم إنشاء الغرفة بنجاح' 
  });
});

app.post('/api/game/join/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { playerName } = req.body;

  if (!playerName) {
    return res.status(400).json({ error: 'اسم اللاعب مطلوب' });
  }

  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: 'الغرفة غير موجودة' });
  }

  if (room.status !== 'waiting') {
    return res.status(400).json({ error: 'اللعبة بدأت بالفعل' });
  }

  if (room.players.length >= 4) {
    return res.status(400).json({ error: 'الغرفة ممتلئة' });
  }

  const nameExists = room.players.some(p => 
    p.name.trim().toLowerCase() === playerName.trim().toLowerCase()
  );
  
  if (nameExists) {
    return res.status(400).json({ 
      error: 'هذا الاسم مستخدم بالفعل في الغرفة! اختر اسماً آخر' 
    });
  }

  room.players.push({
    id: null,
    name: playerName,
    score: 0,
    answers: [],
    remainingGuesses: 5,
    lastUpdateTime: Date.now() // ✅ تتبع آخر تحديث
  });

  res.json({ 
    roomId,
    gameType: room.gameType,
    players: room.players.map(p => ({ name: p.name })),
    message: 'تم الانضمام بنجاح' 
  });
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const topPlayers = await GameResult.find()
      .sort({ wpm: -1 })
      .limit(10)
      .select('playerName wpm accuracy date');
    
    res.json(topPlayers);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في جلب البيانات' });
  }
});

app.post('/api/game/result', async (req, res) => {
  try {
    const { playerName, wpm, accuracy } = req.body;

    if (!playerName || wpm === undefined || accuracy === undefined) {
      return res.status(400).json({ error: 'بيانات ناقصة' });
    }

    const result = new GameResult({ playerName, wpm, accuracy });
    await result.save();

    res.json({ message: 'تم حفظ النتيجة', result });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في حفظ النتيجة' });
  }
});

// ================ Socket.IO ================

io.on('connection', (socket) => {
  console.log('🟢 لاعب جديد متصل:', socket.id);

  // ============= دوال لعبة الفئات =============
  
  const startCategory = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const category = categoryInfo[room.currentCategory];
    
    let mathQuestion = null;
    if (category.id === 'math') {
      mathQuestion = generateMathQuestion();
      room.currentMathQuestion = mathQuestion;
    }
    
    // ✅ حفظ وقت البدء بدقة
    const startTime = Date.now();
    room.categoryStartTime = startTime;
    
    console.log(`🎯 بدء فئة: ${category.name} في الغرفة ${roomId} - الوقت: ${startTime}`);
    
    io.to(roomId).emit('category-started', {
      category: category,
      categoryNumber: room.currentCategory + 1,
      totalCategories: categoryInfo.length,
      mathQuestion: mathQuestion,
      startTime: startTime,
      timeLeft: category.duration, // ✅ الوقت الكامل
      serverTime: Date.now() // ✅ وقت السيرفر للمزامنة
    });

    // ✅ تحديث الوقت كل 5 ثواني للمزامنة
    const syncInterval = setInterval(() => {
      const timeLeft = calculateTimeLeft(startTime, category.duration);
      
      if (timeLeft <= 0) {
        clearInterval(syncInterval);
      } else {
        // إرسال تحديث للوقت لجميع اللاعبين
        io.to(roomId).emit('time-sync', {
          timeLeft,
          serverTime: Date.now()
        });
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(syncInterval);
      endCategory(roomId);
    }, category.duration * 1000);
  };

  const endCategory = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    console.log(`⏱️ انتهت الفئة ${room.currentCategory + 1} في الغرفة ${roomId}`);

    room.currentCategory++;

    if (room.currentCategory < categoryInfo.length) {
      room.usedAnswers = [];
      
      setTimeout(() => {
        startCategory(roomId);
      }, 3000);
    } else {
      room.status = 'finished';
      const results = room.players
        .sort((a, b) => b.score - a.score)
        .map((p, index) => ({
          rank: index + 1,
          name: p.name,
          score: p.score
        }));
      
      console.log('🏁 انتهت لعبة الفئات في الغرفة', roomId);

      io.to(roomId).emit('game-finished', {
        results: results,
        roomId: roomId,
        hostName: room.hostName
      });
    }
  };

  // ============= دوال لعبة الرسم =============

  const startDrawingRound = (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return;

    const drawer = room.players[room.currentDrawer];
    if (!drawer) {
      console.log('❌ لا يوجد رسام في الجولة', room.currentDrawer);
      return;
    }

    const word = room.drawingWords[room.currentDrawer];
    if (!word) {
      console.log('❌ لا توجد كلمة للجولة', room.currentDrawer);
      return;
    }

    room.guessedPlayers = [];
    
    // ✅ حفظ وقت البدء بدقة
    const startTime = Date.now();
    room.roundStartTime = startTime;
    room.canvasDrawings = [];
    room.roundActive = true; // ✅ تفعيل الجولة لقبول التخمينات
    
    room.players.forEach(player => {
      player.remainingGuesses = 5;
    });

    console.log(`🎨 بدء جولة الرسم: ${drawer.name} سيرسم "${word}" - ${startTime}`);

    // ✅ إرسال للرسام
    io.to(drawer.id).emit('your-turn-to-draw', {
      word: word,
      round: room.currentRound + 1,
      totalRounds: room.players.length,
      startTime: startTime,
      timeLeft: 60,
      serverTime: Date.now()
    });

    // ✅ إرسال للمشاهدين
    room.players.forEach(player => {
      if (player.id !== drawer.id) {
        io.to(player.id).emit('someone-drawing', {
          drawerName: drawer.name,
          round: room.currentRound + 1,
          totalRounds: room.players.length,
          startTime: startTime,
          timeLeft: 60,
          serverTime: Date.now()
        });
      }
    });

    // ✅ مزامنة الوقت كل 5 ثواني
    const syncInterval = setInterval(() => {
      const timeLeft = calculateTimeLeft(startTime, 60);
      
      if (timeLeft <= 0) {
        clearInterval(syncInterval);
      } else {
        io.to(roomId).emit('time-sync', {
          timeLeft,
          serverTime: Date.now()
        });
      }
    }, 5000);

    room.roundTimer = setTimeout(() => {
      clearInterval(syncInterval);
      endDrawingRound(roomId);
    }, 60000);
  };

  const endDrawingRound = (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return;

    // ✅ تعيين الجولة كمنتهية لمنع قبول تخمينات إضافية
    room.roundActive = false;

    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    const word = room.drawingWords[room.currentDrawer];
    const drawer = room.players[room.currentDrawer];
    
    // ✅ حساب نقاط الرسام
    const totalPlayers = room.players.length - 1; // عدد اللاعبين غير الرسام
    const guessedCount = room.guessedPlayers.length;
    const allGuessed = guessedCount === totalPlayers;
    
    // نظام النقاط: (عدد_اللي_خمنوا × 25) + مكافأة_الإجماع
    let drawerPoints = guessedCount * 25;
    if (allGuessed && guessedCount > 0) {
      drawerPoints += 50; // مكافأة الإجماع
    }
    
    drawer.score += drawerPoints;
    
    console.log(`🎨 ${drawer.name} (الرسام) حصل على ${drawerPoints} نقطة (${guessedCount}/${totalPlayers} خمنوا${allGuessed ? ' + إجماع' : ''})`);
    console.log(`⏱️ انتهت جولة الرسم ${room.currentRound + 1}`);

    io.to(roomId).emit('round-ended', {
      word: word,
      drawerPoints: drawerPoints,
      drawerName: drawer.name,
      guessedCount: guessedCount,
      totalPlayers: totalPlayers,
      allGuessed: allGuessed,
      scores: room.players.map(p => ({
        name: p.name,
        score: p.score
      }))
    });
    
    // ✅ إعادة تعيين timestamps للجولة القادمة
    room.guessTimestamps = {};

    room.currentRound++;
    room.currentDrawer++;

    setTimeout(() => {
      if (room.currentRound < room.players.length) {
        startDrawingRound(roomId);
      } else {
        room.status = 'finished';
        const results = room.players
          .sort((a, b) => b.score - a.score)
          .map((p, index) => ({
            rank: index + 1,
            name: p.name,
            score: p.score
          }));
        
        console.log('🏁 انتهت لعبة الرسم في الغرفة', roomId);

        io.to(roomId).emit('game-finished', {
          results: results,
          roomId: roomId,
          hostName: room.hostName
        });
      }
    }, 5000);
  };

  // ============= Events عامة =============

  socket.on('join-room', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', 'الغرفة غير موجودة');
      return;
    }

    if (socket.roomId === roomId && socket.playerName === playerName) {
      console.log(`⚠️ ${playerName} محاولة انضمام مكررة - تجاهل`);
      return;
    }

    let player = room.players.find(p => p.name === playerName);
    let isRejoining = false;
    
    if (player) {
      if (player.id && player.id !== socket.id) {
        const timeSinceLastUpdate = Date.now() - (player.lastUpdateTime || 0);
        
        if (timeSinceLastUpdate > 5000) {
          isRejoining = true;
          
          console.log(`🔄 ${playerName} يعود للغرفة ${roomId}`);
          
          if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            delete player.disconnectTimeout;
          }
        } else {
          return;
        }
      }
      
      player.id = socket.id;
      player.lastUpdateTime = Date.now();
    } else {
      player = {
        id: socket.id,
        name: playerName,
        score: 0,
        answers: [],
        remainingGuesses: 5,
        lastUpdateTime: Date.now()
      };
      room.players.push(player);
      console.log(`➕ ${playerName} انضم للغرفة ${roomId}`);
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.playerName = playerName;

    io.to(roomId).emit('room-update', {
      players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
      status: room.status,
      gameType: room.gameType
    });

    if (isRejoining) {
      socket.to(roomId).emit('player-rejoined', {
        playerName: playerName
      });
    }

    io.to(socket.id).emit('scores-update', {
      scores: room.players.map(p => ({
        name: p.name,
        score: p.score || 0
      }))
    });

    // ✅ إعادة اللاعب لحالة اللعبة مع مزامنة الوقت
    if (room.status === 'playing') {
      if (room.gameType === 'drawing') {
        const drawer = room.players[room.currentDrawer];
        
        if (drawer && room.roundStartTime) {
          const timeLeft = calculateTimeLeft(room.roundStartTime, 60);

          if (room.canvasDrawings && room.canvasDrawings.length > 0) {
            io.to(socket.id).emit('restore-canvas', {
              drawings: room.canvasDrawings
            });
          }

          setTimeout(() => {
            if (drawer.name === playerName) {
              const word = room.drawingWords[room.currentDrawer];
              io.to(socket.id).emit('your-turn-to-draw', {
                word: word,
                round: room.currentRound + 1,
                totalRounds: room.players.length,
                timeLeft: timeLeft,
                serverTime: Date.now(),
                isRejoining: true
              });
            } else {
              io.to(socket.id).emit('someone-drawing', {
                drawerName: drawer.name,
                round: room.currentRound + 1,
                totalRounds: room.players.length,
                timeLeft: timeLeft,
                serverTime: Date.now(),
                isRejoining: true
              });
            }
          }, 100);

          io.to(socket.id).emit('guesses-update', {
            remainingGuesses: player.remainingGuesses || 5
          });
        }
      } else if (room.gameType === 'categories') {
        if (room.currentCategory < categoryInfo.length && room.categoryStartTime) {
          const category = categoryInfo[room.currentCategory];
          const timeLeft = calculateTimeLeft(room.categoryStartTime, category.duration);
          
          const response = {
            category: category,
            categoryNumber: room.currentCategory + 1,
            totalCategories: categoryInfo.length,
            startTime: room.categoryStartTime,
            timeLeft: timeLeft,
            serverTime: Date.now()
          };
          
          if (category.id === 'math' && room.currentMathQuestion) {
            response.mathQuestion = room.currentMathQuestion;
          }
          
          io.to(socket.id).emit('category-started', response);
        }
      }
    }
  });

  socket.on('get-scores', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      io.to(socket.id).emit('scores-update', {
        scores: room.players.map(p => ({
          name: p.name,
          score: p.score || 0
        }))
      });
    }
  });

  socket.on('request-category', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.status === 'playing' && room.gameType === 'categories' && room.currentCategory < categoryInfo.length) {
      const category = categoryInfo[room.currentCategory];
      const timeLeft = room.categoryStartTime ? 
                       calculateTimeLeft(room.categoryStartTime, category.duration) : 
                       category.duration;
      
      const response = {
        category: category,
        categoryNumber: room.currentCategory + 1,
        totalCategories: categoryInfo.length,
        startTime: room.categoryStartTime,
        timeLeft: timeLeft,
        serverTime: Date.now()
      };
      
      if (category.id === 'math' && room.currentMathQuestion) {
        response.mathQuestion = room.currentMathQuestion;
      }
      
      io.to(socket.id).emit('category-started', response);
    }
  });

  socket.on('start-game', ({ wordMode }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);

    if (!room || room.status !== 'waiting') return;

    room.status = 'playing';
    room.startTime = Date.now();

    console.log(`🎮 بدء اللعبة في الغرفة ${roomId}`);

    if (room.gameType === 'drawing') {
      room.wordMode = wordMode || 'player';
      room.currentRound = 0;
      room.currentDrawer = 0;
      room.drawingWords = [];

      if (room.wordMode === 'random') {
        const usedWords = new Set();
        
        for (let i = 0; i < room.players.length; i++) {
          let word;
          do {
            word = randomWords[Math.floor(Math.random() * randomWords.length)];
          } while (usedWords.has(word));
          
          usedWords.add(word);
          room.drawingWords.push(word);
        }
        
        console.log('🎲 كلمات عشوائية:', room.drawingWords);

        let countdown = 3;
        const countdownInterval = setInterval(() => {
          io.to(roomId).emit('countdown', countdown);
          countdown--;

          if (countdown < 0) {
            clearInterval(countdownInterval);
            setTimeout(() => startDrawingRound(roomId), 500);
          }
        }, 1000);
      } else if (room.wordMode === 'player') {
        io.to(roomId).emit('waiting-for-words', {
          message: 'كل لاعب يدخل كلمة',
          totalPlayers: room.players.length
        });
      }
    } else {
      room.currentCategory = 0;
      room.usedAnswers = [];

      let countdown = 3;
      const countdownInterval = setInterval(() => {
        io.to(roomId).emit('countdown', countdown);
        countdown--;

        if (countdown < 0) {
          clearInterval(countdownInterval);
          setTimeout(() => startCategory(roomId), 500);
        }
      }, 1000);
    }
  });

  socket.on('submit-answer', ({ answer }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.gameType === 'categories') {
      const category = categoryInfo[room.currentCategory];
      const normalizedAnswer = normalizeText(answer);
      
      let isCorrect = false;
      let isDuplicate = false;
      
      if (category.id === 'math') {
        const userAnswer = parseFloat(answer.trim());
        if (!isNaN(userAnswer) && room.currentMathQuestion) {
          if (Math.abs(userAnswer - room.currentMathQuestion.answer) < 0.01) {
            isCorrect = true;
            room.currentMathQuestion = generateMathQuestion();
            
            io.to(roomId).emit('new-math-question', {
              mathQuestion: room.currentMathQuestion
            });
          }
        }
      } else {
        const validAnswers = categories[category.id].map(a => normalizeText(a));
        const usedAnswersNormalized = room.usedAnswers.map(a => normalizeText(a));
        
        if (validAnswers.includes(normalizedAnswer)) {
          if (usedAnswersNormalized.includes(normalizedAnswer)) {
            isDuplicate = true;
          } else {
            isCorrect = true;
            room.usedAnswers.push(answer.trim());
          }
        }
      }

      if (isCorrect) {
        player.score++;
      }

      io.to(roomId).emit('answer-result', {
        playerName: player.name,
        answer: isCorrect ? null : answer.trim(),
        isCorrect: isCorrect,
        isDuplicate: isDuplicate,
        newScore: player.score
      });

      io.to(roomId).emit('scores-update', {
        scores: room.players.map(p => ({
          name: p.name,
          score: p.score
        }))
      });
    }
  });

  socket.on('change-word-mode', ({ roomId, wordMode }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return;

    room.wordMode = wordMode;
    
    io.to(roomId).emit('word-mode-updated', { wordMode });
  });

  socket.on('request-drawing-state', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.status === 'playing' && room.gameType === 'drawing') {
      const drawer = room.players[room.currentDrawer];
      
      if (drawer && room.roundStartTime) {
        const timeLeft = calculateTimeLeft(room.roundStartTime, 60);
        
        if (drawer.id === socket.id) {
          const word = room.drawingWords[room.currentDrawer];
          io.to(socket.id).emit('your-turn-to-draw', {
            word: word,
            round: room.currentRound + 1,
            totalRounds: room.players.length,
            timeLeft: timeLeft,
            serverTime: Date.now()
          });
        } else {
          io.to(socket.id).emit('someone-drawing', {
            drawerName: drawer.name,
            round: room.currentRound + 1,
            totalRounds: room.players.length,
            timeLeft: timeLeft,
            serverTime: Date.now()
          });
        }

        io.to(socket.id).emit('scores-update', {
          scores: room.players.map(p => ({
            name: p.name,
            score: p.score || 0
          }))
        });
      }
    }
  });

  socket.on('start-editing-word', () => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || room.gameType !== 'drawing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // ✅ إلغاء حالة "جاهز"
    if (room.playersReadyStatus && room.playersReadyStatus[player.name]) {
      room.playersReadyStatus[player.name] = false;
      console.log(`✏️ ${player.name} بدأ تعديل كلمته`);
      
      // ✅ حساب العداد الجديد
      const readyCount = Object.keys(room.playersReadyStatus)
        .filter(name => room.playersReadyStatus[name] === true).length;
      const totalPlayers = room.players.length;

      // ✅ قائمة اللاعبين الجاهزين
      const readyPlayers = room.players
        .filter(p => room.playersReadyStatus[p.name] === true)
        .map(p => ({ name: p.name }));

      // ✅ إشعار جميع اللاعبين
      io.to(roomId).emit('player-editing-word', {
        playerName: player.name,
        message: `${player.name} يعدل كلمته...`
      });

      // ✅ إرسال تحديث العداد
      io.to(roomId).emit('words-update', {
        readyCount: readyCount,
        totalPlayers: totalPlayers,
        readyPlayers: readyPlayers,
        allReady: false
      });

      console.log(`📊 العداد بعد التعديل: ${readyCount}/${totalPlayers}`);
    }
  });

  socket.on('submit-word', ({ word }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || room.gameType !== 'drawing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // ✅ تهيئة المصفوفات إذا لم تكن موجودة
    if (!room.drawingWords) room.drawingWords = [];
    if (!room.playersReadyStatus) room.playersReadyStatus = {};

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    
    // ✅ تعيين الكلمة وتفعيل الجاهزية
    room.drawingWords[playerIndex] = word.trim();
    room.playersReadyStatus[player.name] = true;
    
    console.log(`✅ ${player.name} أرسل كلمة: "${word.trim()}"`);

    // ✅ حساب عدد اللاعبين الجاهزين
    const readyCount = Object.keys(room.playersReadyStatus)
      .filter(name => room.playersReadyStatus[name] === true).length;
    const totalPlayers = room.players.length;

    // ✅ قائمة اللاعبين الجاهزين (للعرض في UI)
    const readyPlayers = room.players
      .filter(p => room.playersReadyStatus[p.name] === true)
      .map(p => ({ name: p.name }));

    // ✅ إرسال تحديث
    io.to(roomId).emit('words-update', {
      readyCount: readyCount,
      totalPlayers: totalPlayers,
      readyPlayers: readyPlayers,
      allReady: readyCount === totalPlayers
    });

    console.log(`📊 العداد: ${readyCount}/${totalPlayers} - الجاهزون: ${readyPlayers.map(p => p.name).join(', ')}`);

    // ✅ بدء اللعبة فقط إذا كل اللاعبين جاهزين
    if (readyCount === totalPlayers) {
      console.log('🎮 كل اللاعبين جاهزين - بدء العد التنازلي');
      
      let countdown = 3;
      const countdownInterval = setInterval(() => {
        io.to(roomId).emit('countdown', countdown);
        countdown--;

        if (countdown < 0) {
          clearInterval(countdownInterval);
          setTimeout(() => startDrawingRound(roomId), 500);
        }
      }, 1000);
    }
  });

  socket.on('draw', ({ roomId, drawData }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (!room.canvasDrawings) {
      room.canvasDrawings = [];
    }
    room.canvasDrawings.push(drawData);

    socket.to(roomId).emit('drawing', drawData);
  });

  socket.on('clear-canvas', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.canvasDrawings = [];
    socket.to(roomId).emit('canvas-cleared');
  });

  socket.on('submit-guess', ({ guess }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || room.gameType !== 'drawing' || room.status !== 'playing') return;

    // ✅ منع التخمينات إذا انتهت الجولة
    if (room.roundActive === false) {
      console.log(`⚠️ محاولة تخمين بعد انتهاء الجولة من ${socket.playerName}`);
      io.to(socket.id).emit('round-already-ended', {
        message: 'انتهت الجولة!'
      });
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const drawer = room.players[room.currentDrawer];
    if (player.id === drawer.id) return;

    if (room.guessedPlayers.includes(player.id)) return;

    if (!player.remainingGuesses || player.remainingGuesses <= 0) {
      io.to(socket.id).emit('no-guesses-left', {
        message: 'لقد استنفذت محاولاتك الـ 5!'
      });
      return;
    }

    const correctWord = room.drawingWords[room.currentDrawer];
    const normalizedGuess = normalizeText(guess);
    const normalizedWord = normalizeText(correctWord);

    if (normalizedGuess === normalizedWord) {
      room.guessedPlayers.push(player.id);
      
      // ✅ حساب الوقت المستغرق بالثواني
      const currentTime = Date.now();
      const timeElapsed = Math.floor((currentTime - room.roundStartTime) / 1000);
      
      // ✅ نظام النقاط الجديد: 100 - الوقت المستغرق (الحد الأدنى: 10)
      const pointsEarned = Math.max(10, 100 - timeElapsed);
      
      player.score += pointsEarned;
      
      console.log(`✅ ${player.name} خمن بعد ${timeElapsed} ثانية وحصل على ${pointsEarned} نقطة`);
      
      // ✅ تسجيل وقت التخمين لحساب نقاط الرسام لاحقاً
      if (!room.guessTimestamps) room.guessTimestamps = {};
      room.guessTimestamps[player.id] = timeElapsed;

      io.to(roomId).emit('correct-guess', {
        playerName: player.name,
        pointsEarned: pointsEarned,
        timeElapsed: timeElapsed,
        scores: room.players.map(p => ({
          name: p.name,
          score: p.score
        }))
      });

      // ✅ فحص: هل انتهت الجولة؟
      const nonDrawerPlayers = room.players.filter(p => p.id !== drawer.id);
      const playersStillPlaying = nonDrawerPlayers.filter(p => 
        !room.guessedPlayers.includes(p.id) && p.remainingGuesses > 0
      );
      
      if (playersStillPlaying.length === 0) {
        console.log('✅ جميع اللاعبين خمنوا أو استنفذوا محاولاتهم - إنهاء الجولة');
        endDrawingRound(roomId);
      }
    } else {
      player.remainingGuesses--;

      io.to(roomId).emit('wrong-guess', {
        playerName: player.name,
        guess: guess,
        remainingGuesses: player.remainingGuesses
      });

      io.to(socket.id).emit('guesses-update', {
        remainingGuesses: player.remainingGuesses
      });

      // ✅ فحص: هل كل اللاعبين (غير الرسام) إما خمنوا أو استنفذوا محاولاتهم؟
      const nonDrawerPlayers = room.players.filter(p => p.id !== drawer.id);
      const playersStillPlaying = nonDrawerPlayers.filter(p => 
        !room.guessedPlayers.includes(p.id) && p.remainingGuesses > 0
      );
      
      if (playersStillPlaying.length === 0) {
        console.log('⚠️ كل اللاعبين إما خمنوا أو استنفذوا محاولاتهم - إنهاء الجولة');
        endDrawingRound(roomId);
      }
    }
  });

  socket.on('player-leave', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    console.log(`🚪 ${playerName} يغادر الغرفة ${roomId} بشكل اختياري`);

    // ✅ البحث عن اللاعب وإلغاء أي timeout
    const player = room.players.find(p => p.name === playerName);
    if (player && player.disconnectTimeout) {
      clearTimeout(player.disconnectTimeout);
      delete player.disconnectTimeout;
    }

    const wasHost = room.hostName === playerName;

    // ✅ حذف اللاعب فوراً
    room.players = room.players.filter(p => p.name !== playerName);

    console.log(`✅ تم حذف ${playerName} فوراً - باقي ${room.players.length} لاعبين`);

    if (room.players.length === 0) {
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
      }
      rooms.delete(roomId);
      console.log(`🗑️ تم حذف الغرفة ${roomId}`);
      return;
    }

    // ✅ نقل الهوست المحسّن
    if (wasHost) {
      if (transferHost(room)) {
        io.to(roomId).emit('host-changed', {
          newHost: room.hostName,
          message: `${room.hostName} أصبح المضيف الجديد`
        });
      }
    }

    // ✅ إشعار باقي اللاعبين بالمغادرة
    io.to(roomId).emit('player-left', {
      playerName: playerName,
      remainingPlayers: room.players.length
    });

    // ✅ تحديث قائمة اللاعبين
    io.to(roomId).emit('room-update', {
      players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
      status: room.status,
      gameType: room.gameType
    });

    // ✅ إذا كان في لعبة الرسم، تحقق من الرسام
    if (room.status === 'playing' && room.gameType === 'drawing') {
      const drawer = room.players[room.currentDrawer];
      if (!drawer) {
        console.log('⚠️ الرسام غادر - إنهاء الجولة');
        endDrawingRound(roomId);
      }
    }
  });

  socket.on('player-ready', ({ roomId, playerName, gameType, action }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.status !== 'finished') return;

    if (action === 'leave') {
      console.log(`🚪 ${playerName} يغادر من صفحة النتائج - الغرفة ${roomId}`);
      
      // ✅ البحث عن اللاعب وإلغاء أي timeout
      const player = room.players.find(p => p.name === playerName);
      if (player && player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        delete player.disconnectTimeout;
      }
      
      const wasHost = room.hostName === playerName;
      
      // ✅ حذف اللاعب فوراً
      room.players = room.players.filter(p => p.name !== playerName);
      
      console.log(`✅ تم حذف ${playerName} فوراً - باقي ${room.players.length} لاعبين`);
      
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`🗑️ تم حذف الغرفة ${roomId}`);
        return;
      }

      // ✅ نقل الهوست المحسّن
      if (wasHost) {
        if (transferHost(room)) {
          io.to(roomId).emit('host-changed', {
            newHost: room.hostName
          });
        }
      }

      // ✅ إشعار باقي اللاعبين
      io.to(roomId).emit('player-left', {
        playerName: playerName,
        remainingPlayers: room.players.length
      });

      return;
    }

    if (playerName === room.hostName && gameType) {
      room.nextGameType = gameType;
    }

    if (!room.playersReady) {
      room.playersReady = [];
    }

    if (!room.playersReady.includes(playerName)) {
      room.playersReady.push(playerName);
    }

    io.to(roomId).emit('players-ready-update', {
      playersReady: room.playersReady,
      hostGameChoice: room.nextGameType,
      totalPlayers: room.players.length
    });

    if (room.playersReady.length === room.players.length && room.nextGameType) {
      // ✅ الهوست يبقى كما هو (أول لاعب في القائمة)
      const currentHost = room.players.length > 0 ? room.players[0].name : room.hostName;

      room.status = 'waiting';
      room.gameType = room.nextGameType;
      room.playersReady = [];
      room.nextGameType = null;
      
      // ✅ تحديث وقت إنشاء الغرفة لمنع الحذف التلقائي
      room.createdAt = Date.now();
      console.log(`🔄 تحديث وقت الغرفة ${roomId} لمنع الحذف التلقائي`);

      room.players.forEach(p => {
        p.score = 0;
        p.answers = [];
        p.remainingGuesses = 5;
      });

      if (room.gameType === 'drawing') {
        room.drawingWords = [];
        room.currentRound = 0;
        room.currentDrawer = 0;
        room.guessedPlayers = [];
        room.wordMode = 'player';
        room.canvasDrawings = [];
        room.submittedPlayers = []; // ✅ مسح قائمة اللاعبين المرسلين
        room.playersReadyStatus = {}; // ✅ مسح حالات الجاهزية
      } else {
        room.currentCategory = 0;
        room.usedAnswers = [];
      }

      // ✅ تعيين الهوست بناءً على أول لاعب في القائمة
      room.hostName = currentHost;
      console.log(`👑 الهوست الحالي: ${room.hostName}`);

      io.to(roomId).emit('room-update', {
        players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
        status: room.status,
        gameType: room.gameType
      });

      io.to(roomId).emit('game-restarting', {
        roomId: roomId,
        gameType: room.gameType,
        hostName: room.hostName
      });
    }
  });

  // ✅ المغادرة الاختيارية الفورية (بدون انتظار 30 ثانية)
  socket.on('leave-room', ({ roomId, playerName: leavingPlayerName }) => {
    const targetRoomId = roomId || socket.roomId;
    const room = rooms.get(targetRoomId);
    
    if (!room) {
      console.log('❌ leave-room: الغرفة غير موجودة:' , targetRoomId);
      return;
    }

    const player = room.players.find(p => p.name === leavingPlayerName);
    
    if (player) {
      console.log(`🚪 ${leavingPlayerName} يغادر الغرفة ${targetRoomId} بشكل اختياري`);
      
      // ✅ إلغاء أي timeout للانقطاع إذا كان موجوداً
      if (player.disconnectTimeout) {
        clearTimeout(player.disconnectTimeout);
        delete player.disconnectTimeout;
      }
      
      // ✅ التحقق من كان اللاعب هو الهوست
      const wasHost = room.hostName === leavingPlayerName;
      
      // ✅ حذف اللاعب فوراً من القائمة
      room.players = room.players.filter(p => p.name !== leavingPlayerName);
      
      console.log(`✅ تم حذف ${leavingPlayerName} فوراً - باقي ${room.players.length} لاعبين`);
      
      // ✅ نقل الهوست إذا كان المغادر هو الهوست
      if (wasHost && room.players.length > 0) {
        if (transferHost(room)) {
          io.to(targetRoomId).emit('host-changed', {
            newHost: room.hostName
          });
          console.log(`👑 تم نقل الهوست إلى ${room.hostName}`);
        }
      }
      
      // ✅ إشعار باقي اللاعبين
      io.to(targetRoomId).emit('player-left', {
        playerName: leavingPlayerName,
        remainingPlayers: room.players.length
      });
      
      // ✅ تحديث قائمة اللاعبين
      io.to(targetRoomId).emit('room-update', {
        players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
        status: room.status,
        gameType: room.gameType
      });
      
      // ✅ حذف الغرفة إذا لم يتبق أحد
      if (room.players.length === 0) {
        if (room.roundTimer) {
          clearTimeout(room.roundTimer);
        }
        rooms.delete(targetRoomId);
        console.log(`🗑️ تم حذف الغرفة ${targetRoomId} (فارغة)`);
      } else if (room.status === 'playing' && room.gameType === 'drawing') {
        // ✅ إذا كان الرسام هو من غادر، ننهي الجولة
        const drawer = room.players[room.currentDrawer];
        if (!drawer) {
          console.log('⚠️ الرسام غادر - إنهاء الجولة');
          endDrawingRound(targetRoomId);
        }
      }
    } else {
      console.log('⚠️ اللاعب غير موجود في الغرفة:' , leavingPlayerName);
    }
  });

  // ✅ طرد لاعب (للهوست فقط)
  socket.on('kick-player', ({ roomId, playerName: kickPlayerName }) => {
    // ✅ استخدام socket.roomId إذا لم يتم إرسال roomId
    const targetRoomId = roomId || socket.roomId;
    const room = rooms.get(targetRoomId);
    
    if (!room) {
      console.log('❌ kick-player: الغرفة غير موجودة:', targetRoomId);
      return;
    }

    const requester = room.players.find(p => p.id === socket.id);
    if (!requester || requester.name !== room.hostName) {
      console.log('⚠️ محاولة طرد من غير الهوست:', requester?.name, 'vs', room.hostName);
      return;
    }

    console.log(`👢 ${room.hostName} يطرد ${kickPlayerName} من الغرفة ${targetRoomId}`);

    // حذف اللاعب من القائمة
    const kickedPlayer = room.players.find(p => p.name === kickPlayerName);
    if (kickedPlayer) {
      room.players = room.players.filter(p => p.name !== kickPlayerName);

      // إشعار اللاعب المطرود
      if (kickedPlayer.id) {
        io.to(kickedPlayer.id).emit('kicked', {
          message: 'تم طردك من الغرفة'
        });
      }

      // تحديث باقي اللاعبين
      io.to(targetRoomId).emit('room-update', {
        players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
        status: room.status,
        gameType: room.gameType
      });

      io.to(targetRoomId).emit('player-left', {
        playerName: kickPlayerName,
        remainingPlayers: room.players.length
      });

      console.log(`✅ تم طرد ${kickPlayerName} - باقي ${room.players.length} لاعبين`);
    } else {
      console.log('❌ اللاعب المطلوب طرده غير موجود:', kickPlayerName);
    }
  });

  // ✅ تغيير نوع اللعبة (للهوست فقط)
  socket.on('change-game-type', ({ roomId, gameType: newGameType }) => {
    // ✅ استخدام socket.roomId إذا لم يتم إرسال roomId
    const targetRoomId = roomId || socket.roomId;
    const room = rooms.get(targetRoomId);
    
    if (!room) {
      console.log('❌ change-game-type: الغرفة غير موجودة:', targetRoomId);
      return;
    }

    const requester = room.players.find(p => p.id === socket.id);
    if (!requester || requester.name !== room.hostName) {
      console.log('⚠️ محاولة تغيير اللعبة من غير الهوست:', requester?.name, 'vs', room.hostName);
      return;
    }

    if (room.status !== 'waiting') {
      console.log('⚠️ لا يمكن تغيير نوع اللعبة أثناء اللعب');
      io.to(socket.id).emit('error', 'لا يمكن تغيير نوع اللعبة أثناء اللعب');
      return;
    }

    console.log(`🎮 ${room.hostName} يغير نوع اللعبة من ${room.gameType} إلى ${newGameType} في الغرفة ${targetRoomId}`);

    const oldGameType = room.gameType;
    room.gameType = newGameType;

    // إعادة تعيين البيانات حسب نوع اللعبة
    if (newGameType === 'drawing') {
      room.drawingWords = [];
      room.currentRound = 0;
      room.currentDrawer = 0;
      room.guessedPlayers = [];
      room.wordMode = room.wordMode || 'player';
      room.canvasDrawings = [];
      room.playersReadyStatus = {};
    } else {
      room.currentCategory = 0;
      room.usedAnswers = [];
    }

    // إشعار جميع اللاعبين
    io.to(targetRoomId).emit('room-update', {
      players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
      status: room.status,
      gameType: room.gameType,
      wordMode: room.wordMode
    });

    io.to(targetRoomId).emit('game-type-changed', {
      gameType: newGameType,
      oldGameType: oldGameType,
      message: `تم تغيير اللعبة إلى ${newGameType === 'drawing' ? 'لعبة الرسم' : 'لعبة الفئات'}`
    });

    console.log(`✅ تم تغيير نوع اللعبة من ${oldGameType} إلى ${newGameType}`);
  });

  socket.on('get-room-state', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      io.to(socket.id).emit('room-update', {
        players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
        status: room.status,
        gameType: room.gameType,
        wordMode: room.wordMode
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 لاعب قطع الاتصال:', socket.id);
    
    const roomId = socket.roomId;
    const playerName = socket.playerName;

    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        
        if (player) {
          socket.to(roomId).emit('player-disconnected', {
            playerName: playerName
          });
          
          const disconnectTimeout = setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (!currentRoom) return;
            
            const stillDisconnected = currentRoom.players.find(
              p => p.name === playerName && p.disconnectTimeout
            );
            
            if (stillDisconnected) {
              const wasHost = currentRoom.hostName === playerName;
              
              currentRoom.players = currentRoom.players.filter(p => p.name !== playerName);
              
              console.log(`❌ ${playerName} لم يعد خلال 30 ثانية`);
              
              // ✅ نقل الهوست المحسّن
              if (wasHost && currentRoom.players.length > 0) {
                if (transferHost(currentRoom)) {
                  io.to(roomId).emit('host-changed', {
                    newHost: currentRoom.hostName
                  });
                }
              }
              
              io.to(roomId).emit('player-left-permanently', {
                playerName: playerName,
                remainingPlayers: currentRoom.players.length
              });
              
              if (currentRoom.players.length === 0) {
                if (currentRoom.roundTimer) {
                  clearTimeout(currentRoom.roundTimer);
                }
                rooms.delete(roomId);
              } else {
                io.to(roomId).emit('room-update', {
                  players: currentRoom.players.map(p => ({ name: p.name, score: p.score || 0 })),
                  status: currentRoom.status,
                  gameType: currentRoom.gameType
                });
                
                if (currentRoom.status === 'playing' && currentRoom.gameType === 'drawing') {
                  const drawer = currentRoom.players[currentRoom.currentDrawer];
                  if (!drawer) {
                    endDrawingRound(roomId);
                  }
                }
              }
            }
          }, 30000);
          
          player.disconnectTimeout = disconnectTimeout;
        }
        
        if (room.playersReady) {
          room.playersReady = room.playersReady.filter(name => name !== playerName);
        }
      }
    }
  });
});

// ================ Helper Functions ================

function generateRoomId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let roomId = '';
  
  for (let i = 0; i < 6; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  while (rooms.has(roomId)) {
    roomId = '';
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return roomId;
}

// تنظيف الغرف القديمة كل 10 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > 600000) {
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
      }
      rooms.delete(roomId);
      console.log(`🗑️ تم حذف الغرفة القديمة ${roomId}`);
    }
  }
}, 600000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`🌐 قبول الاتصالات من: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
});