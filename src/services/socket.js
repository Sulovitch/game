import { io } from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.142:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.playerName = null;
  }

  connect() {
    if (!this.socket || !this.socket.connected) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5, // ✅ تقليل المحاولات
        reconnectionDelay: 2000, // ✅ زيادة التأخير
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.log('🟢 Socket متصل:', this.socket.id);
        
        // ✅ فقط إذا كان في لعبة نشطة (ليس في Lobby)
        if (this.roomId && this.playerName && window.location.pathname !== '/lobby') {
          console.log(`🔄 إعادة الانضمام للغرفة ${this.roomId}`);
          this.socket.emit('join-room', { 
            roomId: this.roomId, 
            playerName: this.playerName 
          });
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔴 Socket انقطع - السبب:', reason);
        
        if (reason === 'io server disconnect') {
          this.socket.connect();
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('✅ تم إعادة الاتصال بعد', attemptNumber, 'محاولة');
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 محاولة إعادة الاتصال #', attemptNumber);
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ فشل إعادة الاتصال:', error.message);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ فشلت جميع محاولات إعادة الاتصال');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ خطأ في الاتصال:', error.message);
      });
    }
    return this.socket;
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
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket غير متصل - تم تجاهل:', event);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new SocketService();