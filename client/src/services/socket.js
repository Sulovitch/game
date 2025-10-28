import { io } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.2:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.playerName = null;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.errorListeners = new Set(); // ✅ لتتبع error listeners
  }

  connect() {
    // ✅ معالجة أخطاء الاتصال
    try {
      if (!this.socket || !this.socket.connected) {
        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          autoConnect: true,
        });

        // ============= Connection Events =============

        this.socket.on('connect', () => {
          console.log('🟢 Socket متصل:', this.socket.id);
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          
          const currentPath = window.location.pathname;
          const isInGame = currentPath === '/drawing-game' || currentPath === '/game-categories';
          const isInLobby = currentPath === '/lobby';
          
          if (this.roomId && this.playerName && (isInGame || isInLobby)) {
            console.log(`🔄 إعادة الانضمام للغرفة ${this.roomId} تلقائياً`);
            
            setTimeout(() => {
              // ✅ إعادة الانضمام للغرفة
              this.socket.emit('join-room', { 
                roomId: this.roomId, 
                playerName: this.playerName 
              });
              
              // ✅ طلب room-update للوبي
              if (isInLobby) {
                this.socket.emit('get-room-state', { roomId: this.roomId });
              }
              
              // ✅ طلب حالة اللعبة للألعاب
              if (currentPath === '/drawing-game') {
                this.socket.emit('request-drawing-state', { roomId: this.roomId });
                this.socket.emit('get-scores', { roomId: this.roomId });
              } else if (currentPath === '/game-categories') {
                this.socket.emit('request-category', { roomId: this.roomId });
                this.socket.emit('get-scores', { roomId: this.roomId });
              }
            }, 100);
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔴 Socket انقطع - السبب:', reason);
          
          if (reason === 'io server disconnect') {
            console.log('🔄 السيرفر قطع الاتصال - محاولة إعادة الاتصال...');
            this.socket.connect();
          } else if (reason === 'transport close' || reason === 'transport error') {
            console.log('⚠️ مشكلة في الاتصال - إعادة المحاولة تلقائياً...');
          } else if (reason === 'ping timeout') {
            console.log('⏱️ انتهى وقت الـ ping - إعادة الاتصال...');
            this.socket.connect();
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log('✅ تم إعادة الاتصال بنجاح بعد', attemptNumber, 'محاولة');
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          
          // ✅ إشعار المستمعين بإعادة الاتصال
          this.notifyErrorListeners('reconnect', { attemptNumber });
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          this.reconnectAttempts = attemptNumber;
          console.log(`🔄 محاولة إعادة الاتصال #${attemptNumber}`);
          
          if (attemptNumber === 3) {
            console.log('⚠️ يتم إعادة الاتصال... الرجاء الانتظار');
            this.notifyErrorListeners('reconnecting', { attemptNumber });
          }
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('❌ فشل محاولة إعادة الاتصال:', error.message);
          this.notifyErrorListeners('reconnect_error', { error });
        });

        this.socket.on('reconnect_failed', () => {
          console.error('❌ فشلت جميع محاولات إعادة الاتصال');
          this.isReconnecting = false;
          
          console.log('💡 الرجاء تحديث الصفحة أو التحقق من الاتصال بالإنترنت');
          this.notifyErrorListeners('reconnect_failed', {});
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ خطأ في الاتصال:', error.message);
          
          this.notifyErrorListeners('connect_error', { error });
          
          if (this.roomId && this.playerName && !this.isReconnecting) {
            this.isReconnecting = true;
            setTimeout(() => {
              if (!this.socket.connected) {
                console.log('🔄 محاولة إعادة الاتصال يدوياً...');
                this.socket.connect();
              }
            }, 5000);
          }
        });

        // ✅ معالجة أخطاء السيرفر
        this.socket.on('error', (error) => {
          console.error('❌ خطأ من السيرفر:', error);
          this.notifyErrorListeners('server_error', { error });
        });
      }
      
      return this.socket;
    } catch (error) {
      console.error('❌ خطأ في إنشاء Socket:', error);
      this.notifyErrorListeners('initialization_error', { error });
      throw error;
    }
  }

  /**
   * ✅ إضافة مستمع للأخطاء
   */
  addErrorListener(callback) {
    if (typeof callback === 'function') {
      this.errorListeners.add(callback);
      return () => this.errorListeners.delete(callback); // cleanup function
    }
  }

  /**
   * ✅ إشعار جميع المستمعين بالخطأ
   */
  notifyErrorListeners(type, data) {
    this.errorListeners.forEach(listener => {
      try {
        listener({ type, data, timestamp: Date.now() });
      } catch (error) {
        console.error('❌ خطأ في error listener:', error);
      }
    });
  }

  setRoomInfo(roomId, playerName) {
    this.roomId = roomId;
    this.playerName = playerName;
    console.log(`💾 حفظ معلومات الغرفة: ${roomId} - ${playerName}`);
  }

  clearRoomInfo() {
    this.roomId = null;
    this.playerName = null;
    console.log('🗑️ مسح معلومات الغرفة');
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 قطع الاتصال يدوياً');
      
      try {
        this.socket.io.reconnection(false);
        this.socket.disconnect();
        this.socket = null;
        
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
      } catch (error) {
        console.error('❌ خطأ في قطع الاتصال:', error);
      }
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  /**
   * ✅ إرسال event مع معالجة الأخطاء
   */
  emit(event, data) {
    try {
      if (this.socket && this.socket.connected) {
        this.socket.emit(event, data);
      } else {
        console.warn(`⚠️ Socket غير متصل - تم تجاهل event: ${event}`);
        
        if (this.socket && !this.socket.connected && !this.isReconnecting) {
          console.log('🔄 محاولة إعادة الاتصال قبل إرسال الـ event...');
          this.isReconnecting = true;
          this.socket.connect();
          
          setTimeout(() => {
            if (this.socket && this.socket.connected) {
              console.log(`✅ إعادة إرسال event: ${event}`);
              this.socket.emit(event, data);
            }
            this.isReconnecting = false;
          }, 1000);
        }
      }
    } catch (error) {
      console.error(`❌ خطأ في إرسال event ${event}:`, error);
      this.notifyErrorListeners('emit_error', { event, error });
    }
  }

  /**
   * ✅ تسجيل listener مع معالجة الأخطاء
   */
  on(event, callback) {
    try {
      if (this.socket) {
        // ✅ wrap callback لمعالجة الأخطاء
        const safeCallback = (...args) => {
          try {
            callback(...args);
          } catch (error) {
            console.error(`❌ خطأ في معالجة event ${event}:`, error);
            this.notifyErrorListeners('listener_error', { event, error });
          }
        };
        
        this.socket.on(event, safeCallback);
      } else {
        console.warn(`⚠️ Socket غير موجود - لا يمكن تسجيل listener: ${event}`);
      }
    } catch (error) {
      console.error(`❌ خطأ في تسجيل listener ${event}:`, error);
    }
  }

  off(event, callback) {
    try {
      if (this.socket) {
        if (callback) {
          this.socket.off(event, callback);
        } else {
          this.socket.off(event);
        }
      }
    } catch (error) {
      console.error(`❌ خطأ في إزالة listener ${event}:`, error);
    }
  }

  removeAllListeners(event) {
    try {
      if (this.socket) {
        this.socket.removeAllListeners(event);
        console.log(`🧹 تم إزالة جميع listeners لـ: ${event}`);
      }
    } catch (error) {
      console.error(`❌ خطأ في إزالة listeners ${event}:`, error);
    }
  }

  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      socketId: this.socket?.id || null,
      roomId: this.roomId,
      playerName: this.playerName,
      reconnectAttempts: this.reconnectAttempts,
      isReconnecting: this.isReconnecting
    };
  }

  forceReconnect() {
    console.log('🔄 إعادة الاتصال القسري...');
    
    try {
      if (this.socket) {
        this.socket.disconnect();
        setTimeout(() => {
          this.socket.connect();
        }, 500);
      } else {
        this.connect();
      }
    } catch (error) {
      console.error('❌ خطأ في إعادة الاتصال القسري:', error);
      this.notifyErrorListeners('force_reconnect_error', { error });
    }
  }
}

export default new SocketService();