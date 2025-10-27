/**
 * 🛡️ Validation Utilities
 * مجموعة دوال للتحقق من صحة البيانات
 */

// ============= Text Validation =============

/**
 * التحقق من اسم اللاعب
 */
export function validatePlayerName(name) {
  const errors = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('اسم اللاعب مطلوب');
    return { isValid: false, errors, sanitized: '' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    errors.push('اسم اللاعب لا يمكن أن يكون فارغاً');
  }
  
  if (trimmed.length < 2) {
    errors.push('اسم اللاعب يجب أن يكون حرفين على الأقل');
  }
  
  if (trimmed.length > 20) {
    errors.push('اسم اللاعب يجب ألا يتجاوز 20 حرف');
  }
  
  // ✅ التحقق من الأحرف المسموحة (عربي، إنجليزي، أرقام، مسافات)
  const validPattern = /^[\u0600-\u06FFa-zA-Z0-9\s]+$/;
  if (!validPattern.test(trimmed)) {
    errors.push('اسم اللاعب يجب أن يحتوي على أحرف عربية أو إنجليزية أو أرقام فقط');
  }
  
  // ✅ منع الأسماء المسيئة (قائمة أساسية)
  const bannedWords = ['admin', 'bot', 'system', 'server'];
  const lowerName = trimmed.toLowerCase();
  if (bannedWords.some(word => lowerName.includes(word))) {
    errors.push('هذا الاسم غير مسموح به');
  }
  
  // ✅ تنظيف المسافات المتعددة
  const sanitized = trimmed.replace(/\s+/g, ' ');
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * التحقق من Room ID
 */
export function validateRoomId(roomId) {
  const errors = [];
  
  if (!roomId || typeof roomId !== 'string') {
    errors.push('رمز الغرفة مطلوب');
    return { isValid: false, errors, sanitized: '' };
  }
  
  const trimmed = roomId.trim().toUpperCase();
  
  if (trimmed.length !== 6) {
    errors.push('رمز الغرفة يجب أن يكون 6 أحرف');
  }
  
  // ✅ التحقق من الأحرف والأرقام المسموحة فقط
  const validPattern = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
  if (!validPattern.test(trimmed)) {
    errors.push('رمز الغرفة يحتوي على أحرف غير صالحة');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: trimmed
  };
}

/**
 * التحقق من كلمة الرسم
 */
export function validateDrawingWord(word) {
  const errors = [];
  
  if (!word || typeof word !== 'string') {
    errors.push('الكلمة مطلوبة');
    return { isValid: false, errors, sanitized: '' };
  }
  
  const trimmed = word.trim();
  
  if (trimmed.length === 0) {
    errors.push('الكلمة لا يمكن أن تكون فارغة');
  }
  
  if (trimmed.length < 2) {
    errors.push('الكلمة يجب أن تكون حرفين على الأقل');
  }
  
  if (trimmed.length > 30) {
    errors.push('الكلمة يجب ألا تتجاوز 30 حرف');
  }
  
  // ✅ التحقق من الأحرف العربية فقط (والمسافات)
  const arabicPattern = /^[\u0600-\u06FF\s]+$/;
  if (!arabicPattern.test(trimmed)) {
    errors.push('الكلمة يجب أن تحتوي على أحرف عربية فقط');
  }
  
  // ✅ منع الكلمات المسيئة أو غير المناسبة
  const inappropriateWords = []; // أضف الكلمات الممنوعة
  const lowerWord = trimmed.toLowerCase();
  if (inappropriateWords.some(word => lowerWord.includes(word))) {
    errors.push('هذه الكلمة غير مناسبة');
  }
  
  const sanitized = trimmed.replace(/\s+/g, ' ');
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * التحقق من الإجابة/التخمين
 */
export function validateAnswer(answer, maxLength = 50) {
  const errors = [];
  
  if (!answer || typeof answer !== 'string') {
    errors.push('الإجابة مطلوبة');
    return { isValid: false, errors, sanitized: '' };
  }
  
  const trimmed = answer.trim();
  
  if (trimmed.length === 0) {
    errors.push('الإجابة لا يمكن أن تكون فارغة');
  }
  
  if (trimmed.length > maxLength) {
    errors.push(`الإجابة يجب ألا تتجاوز ${maxLength} حرف`);
  }
  
  const sanitized = trimmed.replace(/\s+/g, ' ');
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

// ============= Number Validation =============

/**
 * التحقق من عدد اللاعبين
 */
export function validatePlayerCount(count) {
  const errors = [];
  
  if (typeof count !== 'number' || isNaN(count)) {
    errors.push('عدد اللاعبين يجب أن يكون رقم');
    return { isValid: false, errors, value: 0 };
  }
  
  if (!Number.isInteger(count)) {
    errors.push('عدد اللاعبين يجب أن يكون رقم صحيح');
  }
  
  if (count < 2) {
    errors.push('يجب أن يكون هناك لاعبان على الأقل');
  }
  
  if (count > 8) {
    errors.push('الحد الأقصى 8 لاعبين');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    value: Math.floor(count)
  };
}

/**
 * التحقق من رقم الجولة
 */
export function validateRoundNumber(round, maxRounds) {
  const errors = [];
  
  if (typeof round !== 'number' || isNaN(round)) {
    errors.push('رقم الجولة يجب أن يكون رقم');
    return { isValid: false, errors, value: 0 };
  }
  
  if (round < 0) {
    errors.push('رقم الجولة لا يمكن أن يكون سالب');
  }
  
  if (maxRounds && round > maxRounds) {
    errors.push(`رقم الجولة يجب ألا يتجاوز ${maxRounds}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    value: round
  };
}

/**
 * التحقق من النقاط
 */
export function validateScore(score) {
  const errors = [];
  
  if (typeof score !== 'number' || isNaN(score)) {
    errors.push('النقاط يجب أن تكون رقم');
    return { isValid: false, errors, value: 0 };
  }
  
  if (!Number.isInteger(score)) {
    errors.push('النقاط يجب أن تكون رقم صحيح');
  }
  
  if (score < 0) {
    errors.push('النقاط لا يمكن أن تكون سالبة');
  }
  
  if (score > 10000) {
    errors.push('النقاط تتجاوز الحد المسموح');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    value: Math.max(0, Math.floor(score))
  };
}

// ============= Canvas Validation =============

/**
 * التحقق من بيانات الرسم
 */
export function validateDrawingData(data) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('بيانات الرسم غير صالحة');
    return { isValid: false, errors };
  }
  
  // ✅ التحقق من النوع
  if (!['start', 'draw'].includes(data.type)) {
    errors.push('نوع الرسم غير صالح');
  }
  
  // ✅ التحقق من الإحداثيات (0-1)
  if (typeof data.x !== 'number' || data.x < 0 || data.x > 1) {
    errors.push('إحداثيات X غير صالحة');
  }
  
  if (typeof data.y !== 'number' || data.y < 0 || data.y > 1) {
    errors.push('إحداثيات Y غير صالحة');
  }
  
  // ✅ التحقق من حجم الفرشاة
  if (typeof data.brushSize !== 'number' || data.brushSize < 1 || data.brushSize > 50) {
    errors.push('حجم الفرشاة غير صالح');
  }
  
  // ✅ التحقق من اللون
  const colorPattern = /^#[0-9A-Fa-f]{6}$/;
  if (data.color && !colorPattern.test(data.color)) {
    errors.push('اللون غير صالح');
  }
  
  // ✅ التحقق من isEraser
  if (data.isEraser !== undefined && typeof data.isEraser !== 'boolean') {
    errors.push('قيمة isEraser يجب أن تكون boolean');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      type: data.type,
      x: Math.max(0, Math.min(1, data.x || 0)),
      y: Math.max(0, Math.min(1, data.y || 0)),
      brushSize: Math.max(1, Math.min(50, data.brushSize || 3)),
      color: data.color || '#000000',
      isEraser: data.isEraser || false
    }
  };
}

// ============= Game State Validation =============

/**
 * التحقق من نوع اللعبة
 */
export function validateGameType(gameType) {
  const validTypes = ['categories', 'drawing'];
  
  if (!gameType || typeof gameType !== 'string') {
    return { isValid: false, errors: ['نوع اللعبة مطلوب'], value: null };
  }
  
  if (!validTypes.includes(gameType)) {
    return { 
      isValid: false, 
      errors: ['نوع اللعبة غير صالح'],
      value: null 
    };
  }
  
  return { isValid: true, errors: [], value: gameType };
}

/**
 * التحقق من حالة اللعبة
 */
export function validateGameStatus(status) {
  const validStatuses = ['waiting', 'playing', 'finished'];
  
  if (!status || typeof status !== 'string') {
    return { isValid: false, errors: ['حالة اللعبة مطلوبة'], value: null };
  }
  
  if (!validStatuses.includes(status)) {
    return { 
      isValid: false, 
      errors: ['حالة اللعبة غير صالحة'],
      value: null 
    };
  }
  
  return { isValid: true, errors: [], value: status };
}

/**
 * التحقق من وضع الكلمات
 */
export function validateWordMode(wordMode) {
  const validModes = ['player', 'random'];
  
  if (!wordMode || typeof wordMode !== 'string') {
    return { isValid: false, errors: ['وضع الكلمات مطلوب'], value: null };
  }
  
  if (!validModes.includes(wordMode)) {
    return { 
      isValid: false, 
      errors: ['وضع الكلمات غير صالح'],
      value: null 
    };
  }
  
  return { isValid: true, errors: [], value: wordMode };
}

// ============= Sanitization =============

/**
 * تنظيف النص من HTML/XSS
 */
export function sanitizeHTML(text) {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * تنظيف النص العربي
 */
export function sanitizeArabicText(text) {
  if (typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ')  // مسافات متعددة → مسافة واحدة
    .replace(/ة/g, 'ه')    // توحيد التاء المربوطة
    .replace(/أ|إ|آ/g, 'ا') // توحيد الألف
    .replace(/ى/g, 'ي');    // توحيد الياء
}

// ============= Batch Validation =============

/**
 * التحقق من مجموعة بيانات
 */
export function validateBatch(data, schema) {
  const results = {};
  const allErrors = [];
  
  for (const [key, validator] of Object.entries(schema)) {
    const result = validator(data[key]);
    results[key] = result;
    
    if (!result.isValid) {
      allErrors.push(...result.errors.map(err => `${key}: ${err}`));
    }
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    results
  };
}