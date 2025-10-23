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

// قوائم الفئات (للعبة الفئات)
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

// معلومات الفئات
const categoryInfo = [
  { id: 'animals', name: 'حيوانات', icon: '🐱', duration: 20 },
  { id: 'fruits', name: 'فواكه', icon: '🍎', duration: 20 },
  { id: 'math', name: 'عمليات حسابية', icon: '➗', duration: 20 }
];

// قائمة كلمات عشوائية للرسم
const randomWords = [
  'سيارة', 'شجرة', 'قطة', 'كلب', 'بيت', 'شمس', 'قمر', 'نجمة', 'زهرة', 'سمكة',
  'طائرة', 'قارب', 'دراجة', 'كرة', 'كتاب', 'قلم', 'كوب', 'طاولة', 'كرسي', 'باب',
  'شباك', 'ساعة', 'هاتف', 'حاسوب', 'تلفاز', 'نظارة', 'قبعة', 'حذاء', 'قميص', 'سروال',
  'فراشة', 'نحلة', 'عصفور', 'أرنب', 'فيل', 'أسد', 'نمر', 'دب', 'ثعلب', 'غزال',
  'تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'جبل', 'نهر', 'بحر', 'سحابة', 'مطر'
];

// دالة لتوحيد النص
function normalizeText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/ة/g, 'ه')
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/\s+/g, ' ');
}

// دالة لتوليد سؤال رياضي
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

// ✅ دالة لنقل الهوست للاعب التالي
function transferHost(room) {
  if (!room || room.players.length === 0) return false;
  
  // البحث عن لاعب متصل ليصبح الهوست الجديد
  const newHost = room.players.find(p => p.id !== null);
  
  if (newHost) {
    const oldHost = room.hostName;
    room.hostName = newHost.name;
    console.log(`👑 تم نقل الهوست من ${oldHost} إلى ${newHost.name}`);
    return true;
  }
  
  return false;
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
      remainingGuesses: 5
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

  // ✅ التحقق من عدم وجود اسم مكرر
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
    remainingGuesses: 5
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

// ================ Socket.IO للـ Real-time ================

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
    
    const startTime = Date.now();
    room.categoryStartTime = startTime;
    
    console.log(`🎯 بدء فئة: ${category.name} في الغرفة ${roomId}`);
    
    io.to(roomId).emit('category-started', {
      category: category,
      categoryNumber: room.currentCategory + 1,
      totalCategories: categoryInfo.length,
      mathQuestion: mathQuestion,
      startTime: startTime
    });

    setTimeout(() => {
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
      
      console.log('🏁 انتهت لعبة الفئات في الغرفة', roomId, '- النتائج:', results);

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
    room.roundStartTime = Date.now();
    room.canvasDrawings = [];
    
    room.players.forEach(player => {
      player.remainingGuesses = 5;
    });

    console.log(`🎨 بدء جولة الرسم: ${drawer.name} سيرسم "${word}" - الجولة ${room.currentRound + 1}/${room.players.length}`);

    io.to(drawer.id).emit('your-turn-to-draw', {
      word: word,
      round: room.currentRound + 1,
      totalRounds: room.players.length
    });

    room.players.forEach(player => {
      if (player.id !== drawer.id) {
        io.to(player.id).emit('someone-drawing', {
          drawerName: drawer.name,
          round: room.currentRound + 1,
          totalRounds: room.players.length
        });
      }
    });

    room.roundTimer = setTimeout(() => {
      endDrawingRound(roomId);
    }, 60000);
  };

  const endDrawingRound = (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return;

    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }

    const word = room.drawingWords[room.currentDrawer];
    
    console.log(`⏱️ انتهت جولة الرسم ${room.currentRound + 1}. الكلمة كانت: "${word}"`);

    io.to(roomId).emit('round-ended', {
      word: word,
      scores: room.players.map(p => ({
        name: p.name,
        score: p.score
      }))
    });

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
        
        console.log('🏁 انتهت لعبة الرسم في الغرفة', roomId, '- النتائج:', results);

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

  // ✅ التحقق إذا كان هذا الـ socket نفسه انضم من قبل
  if (socket.roomId === roomId && socket.playerName === playerName) {
    console.log(`⚠️ ${playerName} محاولة انضمام مكررة من نفس الـ socket - تم تجاهله`);
    return;
  }

  let player = room.players.find(p => p.name === playerName);
  let isRejoining = false;
  
  if (player) {
    if (player.id && player.id !== socket.id) {
      const timeSinceLastUpdate = Date.now() - (player.lastUpdateTime || 0);
      
      if (timeSinceLastUpdate > 5000) {
        isRejoining = true;
        
        const oldId = player.id;
        console.log(`🔄 ${playerName} يعود للغرفة ${roomId}`);
        console.log(`   📌 ID القديم: ${oldId}`);
        console.log(`   📌 ID الجديد: ${socket.id}`);
        console.log(`   ⏱️ مضى ${Math.round(timeSinceLastUpdate / 1000)} ثانية`);
        
        if (player.disconnectTimeout) {
          clearTimeout(player.disconnectTimeout);
          delete player.disconnectTimeout;
          console.log(`   ✅ تم إلغاء مؤقت المغادرة`);
        }
      } else {
        // ✅ تحذير بسيط بدون إزعاج
        // console.log(`⚪ ${playerName} انضمام سريع (${Math.round(timeSinceLastUpdate)}ms)`);
        return;
      }
    } else if (!player.id) {
      console.log(`✅ ${playerName} حصل على ID: ${socket.id}`);
    } else {
      // ✅ نفس الـ ID - تحديث بسيط
      player.lastUpdateTime = Date.now();
      return;
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
    console.log(`➕ ${playerName} انضم كلاعب جديد للغرفة ${roomId}`);
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
      playerName: playerName,
      message: `${playerName} عاد للعبة`
    });
    console.log(`   📢 تم إرسال إشعار العودة لباقي اللاعبين`);
  }

  io.to(socket.id).emit('scores-update', {
    scores: room.players.map(p => ({
      name: p.name,
      score: p.score || 0
    }))
  })

  // ✅ إعادة اللاعب لحالة اللعبة (فقط إذا كانت اللعبة playing)
  if (room.status === 'playing') {
    if (room.gameType === 'drawing') {
      const drawer = room.players[room.currentDrawer];
      
      if (drawer) {
        const timeElapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
        const timeLeft = Math.max(0, 60 - timeElapsed);

        if (room.canvasDrawings && room.canvasDrawings.length > 0) {
          io.to(socket.id).emit('restore-canvas', {
            drawings: room.canvasDrawings
          });
          console.log(`   🎨 تم إرسال ${room.canvasDrawings.length} رسمة محفوظة`);
        }

        setTimeout(() => {
          if (drawer.name === playerName) {
            const word = room.drawingWords[room.currentDrawer];
            io.to(socket.id).emit('your-turn-to-draw', {
              word: word,
              round: room.currentRound + 1,
              totalRounds: room.players.length,
              timeLeft: timeLeft,
              isRejoining: true
            });
            console.log(`   🎨 ${playerName} عاد وهو الرسام - الكلمة: ${word} - الوقت المتبقي: ${timeLeft}ث`);
          } else {
            io.to(socket.id).emit('someone-drawing', {
              drawerName: drawer.name,
              round: room.currentRound + 1,
              totalRounds: room.players.length,
              timeLeft: timeLeft,
              isRejoining: true
            });
            console.log(`   👀 ${playerName} عاد كمشاهد - الرسام: ${drawer.name} - الوقت المتبقي: ${timeLeft}ث`);
          }
        }, 100);

        io.to(socket.id).emit('guesses-update', {
          remainingGuesses: player.remainingGuesses || 5
        });
      }
    } else if (room.gameType === 'categories') {
      if (room.currentCategory < categoryInfo.length) {
        const category = categoryInfo[room.currentCategory];
        
        const timeElapsed = Math.floor((Date.now() - room.categoryStartTime) / 1000);
        const categoryDuration = category.duration;
        const timeLeft = Math.max(0, categoryDuration - timeElapsed);
        
        const response = {
          category: category,
          categoryNumber: room.currentCategory + 1,
          totalCategories: categoryInfo.length,
          startTime: room.categoryStartTime,
          timeLeft: timeLeft
        };
        
        if (category.id === 'math' && room.currentMathQuestion) {
          response.mathQuestion = room.currentMathQuestion;
        }
        
        io.to(socket.id).emit('category-started', response);
        console.log(`   📚 ${playerName} عاد للفئة: ${category.name} - الوقت المتبقي: ${timeLeft}ث`);
      }
    }
  }

  console.log(`✅ ${playerName} ${isRejoining ? 'عاد بنجاح' : 'في الغرفة'} ${roomId}`);
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

  

  // ============= Events لعبة الفئات =============

  socket.on('request-category', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.status === 'playing' && room.gameType === 'categories' && room.currentCategory < categoryInfo.length) {
      const category = categoryInfo[room.currentCategory];
      const response = {
        category: category,
        categoryNumber: room.currentCategory + 1,
        totalCategories: categoryInfo.length,
        startTime: room.categoryStartTime
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

    console.log(`🎮 بدء اللعبة في الغرفة ${roomId} - نوع اللعبة: ${room.gameType}`);

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
  
  console.log('🎲 تم اختيار كلمات عشوائية:', room.drawingWords);
  console.log('⏱️ بدء العد التنازلي للكلمات العشوائية...');

  let countdown = 3;
  const countdownInterval = setInterval(() => {
    io.to(roomId).emit('countdown', countdown);
    console.log(`⏱️ العد التنازلي: ${countdown}`);
    countdown--;

    if (countdown < 0) {
      clearInterval(countdownInterval);
      console.log('🎮 بدء جولة الرسم الآن!');
      setTimeout(() => {
        startDrawingRound(roomId);
      }, 500);
    }
  }, 1000);
} else if (room.wordMode === 'player') {
        console.log(`📝 إرسال طلب الكلمات لـ ${room.players.length} لاعبين`);
        
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

  // ============= Events لعبة الرسم =============

  socket.on('change-word-mode', ({ roomId, wordMode }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameType !== 'drawing') return;

    room.wordMode = wordMode;
    
    io.to(roomId).emit('word-mode-updated', { wordMode });
    console.log(`🔄 تم تغيير نظام الكلمات في الغرفة ${roomId} إلى: ${wordMode}`);
  });

  socket.on('request-drawing-state', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.status === 'playing' && room.gameType === 'drawing') {
      const drawer = room.players[room.currentDrawer];
      
      if (drawer) {
        if (drawer.id === socket.id) {
          const word = room.drawingWords[room.currentDrawer];
          io.to(socket.id).emit('your-turn-to-draw', {
            word: word,
            round: room.currentRound + 1,
            totalRounds: room.players.length
          });
        } else {
          io.to(socket.id).emit('someone-drawing', {
            drawerName: drawer.name,
            round: room.currentRound + 1,
            totalRounds: room.players.length
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

socket.on('submit-word', ({ word }) => {
  const roomId = socket.roomId;
  const room = rooms.get(roomId);
  
  if (!room || room.gameType !== 'drawing') return;

  const player = room.players.find(p => p.id === socket.id);
  if (!player) return;

  room.drawingWords.push(word.trim());

  console.log(`📝 ${player.name} أدخل كلمة: "${word.trim()}" - المجموع: ${room.drawingWords.length}/${room.players.length}`);

  io.to(roomId).emit('words-update', {
    wordsCount: room.drawingWords.length,
    totalPlayers: room.players.length
  });

  if (room.drawingWords.length === room.players.length) {
    console.log('✅ جميع اللاعبين أدخلوا كلماتهم - بدء العد التنازلي!');
    
    // ✅✅✅ عد تنازلي 3، 2، 1، 0
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      io.to(roomId).emit('countdown', countdown);
      console.log(`⏱️ العد التنازلي: ${countdown}`);
      countdown--;

      if (countdown < 0) {
        clearInterval(countdownInterval);
        console.log('🎮 بدء جولة الرسم الآن!');
        setTimeout(() => {
          startDrawingRound(roomId);
        }, 500);
      }
    }, 1000);
  }
});

  socket.on('draw', ({ roomId, drawData }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // ✅ حفظ الرسمة في الغرفة
    if (!room.canvasDrawings) {
      room.canvasDrawings = [];
    }
    room.canvasDrawings.push(drawData);

    // إرسال للآخرين
    socket.to(roomId).emit('drawing', drawData);
  });

  socket.on('clear-canvas', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // ✅ مسح الرسومات المحفوظة
    room.canvasDrawings = [];

    socket.to(roomId).emit('canvas-cleared');
  });

  socket.on('submit-guess', ({ guess }) => {
    const roomId = socket.roomId;
    const room = rooms.get(roomId);
    
    if (!room || room.gameType !== 'drawing' || room.status !== 'playing') return;

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
      player.score++;
      drawer.score++;

      console.log(`✅ ${player.name} خمّن الكلمة "${correctWord}" بشكل صحيح!`);

      io.to(roomId).emit('correct-guess', {
        playerName: player.name,
        scores: room.players.map(p => ({
          name: p.name,
          score: p.score
        }))
      });

      if (room.guessedPlayers.length === room.players.length - 1) {
        console.log('🎉 جميع اللاعبين خمّنوا الكلمة - إنهاء الجولة مبكراً');
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
    }
  });

  // ============= مغادرة اللاعب =============

  socket.on('player-leave', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    console.log(`🚪 ${playerName} يغادر الغرفة ${roomId}`);

    // ✅ التحقق إذا اللاعب هو الهوست
    const wasHost = room.hostName === playerName;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      if (room.roundTimer) {
        clearTimeout(room.roundTimer);
      }
      rooms.delete(roomId);
      console.log(`🗑️ تم حذف الغرفة ${roomId} - لا يوجد لاعبين`);
      return;
    }

    // ✅ نقل الهوست إذا كان المغادر هو الهوست
    if (wasHost) {
      if (transferHost(room)) {
        io.to(roomId).emit('host-changed', {
          newHost: room.hostName,
          message: `${room.hostName} أصبح المضيف الجديد`
        });
      }
    }

    io.to(roomId).emit('room-update', {
      players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
      status: room.status,
      gameType: room.gameType
    });

    io.to(roomId).emit('player-left', {
      playerName: playerName,
      remainingPlayers: room.players.length
    });

    if (room.status === 'playing') {
      if (room.gameType === 'drawing') {
        const drawer = room.players[room.currentDrawer];
        if (!drawer) {
          console.log('🔄 الرسام غادر - إنهاء الجولة');
          endDrawingRound(roomId);
        }
      }
    }
  });


  // ============= إعادة اللعبة (من صفحة النتائج) =============

    // ✅ Handler لطلب حالة الغرفة يدوياً
  socket.on('get-room-state', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      console.log(`📤 إرسال room-state للغرفة ${roomId}`);
      io.to(socket.id).emit('room-update', {
        players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
        status: room.status,
        gameType: room.gameType,
        wordMode: room.wordMode
      });
    }
  });

socket.on('player-ready', ({ roomId, playerName, gameType, action }) => {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.status !== 'finished') return;

  if (action === 'leave') {
    console.log(`🚪 ${playerName} يغادر من صفحة النتائج`);
    
    const wasHost = room.hostName === playerName;
    
    room.players = room.players.filter(p => p.name !== playerName);
    
    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`🗑️ تم حذف الغرفة ${roomId}`);
      return;
    }

    if (wasHost) {
      if (transferHost(room)) {
        io.to(roomId).emit('host-changed', {
          newHost: room.hostName,
          message: `${room.hostName} أصبح المضيف الجديد`
        });
      }
    }

    io.to(roomId).emit('player-left', {
      playerName: playerName,
      remainingPlayers: room.players.length
    });

    return;
  }

  if (playerName === room.hostName && gameType) {
    room.nextGameType = gameType;
    console.log(`👑 المضيف ${playerName} اختار اللعبة التالية: ${gameType}`);
  }

  if (!room.playersReady) {
    room.playersReady = [];
  }

  if (!room.playersReady.includes(playerName)) {
    room.playersReady.push(playerName);
    console.log(`✓ ${playerName} مستعد - (${room.playersReady.length}/${room.players.length})`);
  }

  io.to(roomId).emit('players-ready-update', {
    playersReady: room.playersReady,
    hostGameChoice: room.nextGameType,
    totalPlayers: room.players.length
  });

if (room.playersReady.length === room.players.length && room.nextGameType) {
  console.log('🎮 جميع اللاعبين جاهزين - إعادة تشغيل اللعبة');

  const originalHost = room.hostName;
  console.log(`💾 حفظ الهوست الأصلي: ${originalHost}`);

  room.status = 'waiting';
  room.gameType = room.nextGameType;
  room.playersReady = [];
  room.nextGameType = null;

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
  } else {
    room.currentCategory = 0;
    room.usedAnswers = [];
  }

  room.hostName = originalHost;
  console.log(`✅ تم استعادة الهوست: ${room.hostName}`);

  // ✅✅✅ إرسال room-update أولاً (مهم جداً!)
  console.log('📡 إرسال room-update مع قائمة اللاعبين');
  io.to(roomId).emit('room-update', {
    players: room.players.map(p => ({ name: p.name, score: p.score || 0 })),
    status: room.status,
    gameType: room.gameType
  });

  // ✅ ثم إرسال game-restarting
  console.log('📡 إرسال game-restarting');
  io.to(roomId).emit('game-restarting', {
    roomId: roomId,
    gameType: room.gameType,
    hostName: room.hostName
  });
}
});

  // ============= قطع الاتصال =============

  socket.on('disconnect', () => {
    console.log('🔴 لاعب قطع الاتصال:', socket.id);
    
    const roomId = socket.roomId;
    const playerName = socket.playerName;

    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        
        if (player) {
          console.log(`🔌 ${playerName} انقطع من الغرفة ${roomId} - في انتظار العودة...`);
          
          socket.to(roomId).emit('player-disconnected', {
            playerName: playerName,
            message: `${playerName} انقطع اتصاله`
          });
          
          const disconnectTimeout = setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (!currentRoom) return;
            
            const stillDisconnected = currentRoom.players.find(
              p => p.name === playerName && p.disconnectTimeout
            );
            
            if (stillDisconnected) {
              // ✅ التحقق إذا كان الهوست
              const wasHost = currentRoom.hostName === playerName;
              
              currentRoom.players = currentRoom.players.filter(p => p.name !== playerName);
              
              console.log(`❌ ${playerName} لم يعد خلال 30 ثانية - تم إزالته نهائياً`);
              
              // ✅ نقل الهوست إذا لزم الأمر
              if (wasHost && currentRoom.players.length > 0) {
                if (transferHost(currentRoom)) {
                  io.to(roomId).emit('host-changed', {
                    newHost: currentRoom.hostName,
                    message: `${currentRoom.hostName} أصبح المضيف الجديد`
                  });
                }
              }
              
              io.to(roomId).emit('player-left-permanently', {
                playerName: playerName,
                message: `${playerName} غادر اللعبة`,
                remainingPlayers: currentRoom.players.length
              });
              
              if (currentRoom.players.length === 0) {
                if (currentRoom.roundTimer) {
                  clearTimeout(currentRoom.roundTimer);
                }
                rooms.delete(roomId);
                console.log(`🗑️ تم حذف الغرفة ${roomId}`);
              } else {
                io.to(roomId).emit('room-update', {
                  players: currentRoom.players.map(p => ({ name: p.name, score: p.score || 0 })),
                  status: currentRoom.status,
                  gameType: currentRoom.gameType
                });
                
                if (currentRoom.status === 'playing' && currentRoom.gameType === 'drawing') {
                  const drawer = currentRoom.players[currentRoom.currentDrawer];
                  if (!drawer) {
                    console.log('🔄 الرسام غادر نهائياً - إنهاء الجولة');
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

}); // ✅ إغلاق io.on('connection')

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

// ================ Start Server ================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
  console.log(`🌐 قبول الاتصالات من: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
});