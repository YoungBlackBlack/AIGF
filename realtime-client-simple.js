class RealtimeClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isRecording = false;
        this.audioContext = null;
        this.stream = null;
        this.sessionId = null;
        this.connectId = this.generateUUID();
        this.callStartTime = null;
        this.callTimer = null;
        this.isInCall = false;
        this.isMuted = false;
        this.audioProcessor = null;
        
        // API配置 - 自动检测部署环境
        this.config = {
            appId: '9047255535',
            accessKey: '8YrYKqRMJmIYslYKYhBoxki-yhHnYN7U',
            url: this.getWebSocketUrl()
        };
        
        this.initAudio();
    }
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    getWebSocketUrl() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // 本地开发
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'ws://localhost:8080';
        }
        
        // Render.com 部署
        if (hostname.includes('.onrender.com')) {
            return `${protocol}//${hostname}`;
        }
        
        // 其他部署环境
        return `${protocol}//${hostname}:8080`;
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            this.setupVolumeIndicator();
            console.log('音频初始化成功');
            
        } catch (error) {
            console.error('音频初始化失败:', error);
            this.updateStatus('音频初始化失败');
        }
    }
    
    setupVolumeIndicator() {
        const analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        source.connect(analyser);
        
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const updateVolume = () => {
            if (!this.isInCall) return;
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            const volumePercent = (average / 255) * 100;
            
            document.getElementById('volumeBar').style.width = volumePercent + '%';
            
            if (this.isInCall) {
                requestAnimationFrame(updateVolume);
            }
        };
        
        updateVolume();
    }
    
    connect() {
        this.updateStatus('连接中...');
        console.log('开始连接到代理服务器...');
        
        const wsUrl = `${this.config.url}?` + new URLSearchParams({
            appId: this.config.appId,
            accessKey: this.config.accessKey,
            connectId: this.connectId
        }).toString();
        
        console.log('连接URL:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';
        
        this.ws.onopen = () => {
            console.log('WebSocket连接已建立');
            this.isConnected = true;
            this.updateStatus('已连接');
            this.sendStartConnection();
        };
        
        this.ws.onmessage = async (event) => {
            console.log('收到消息，长度:', event.data.byteLength);
            await this.handleMessage(event.data);
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket连接关闭:', event.code, event.reason);
            this.isConnected = false;
            this.updateStatus('连接已断开');
            if (this.isInCall) {
                this.endCall();
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.updateStatus('连接错误');
        };
    }
    
    // 简化版协议实现（基于Python示例）
    generateHeader(messageType = 0x01, flags = 0x04, serialization = 0x01, compression = 0x01) {
        const header = new Uint8Array(4);
        header[0] = (0x01 << 4) | 0x01; // Protocol version (0001) + Header size (0001)
        header[1] = (messageType << 4) | flags; // Message type + flags
        header[2] = (serialization << 4) | compression; // Serialization + compression
        header[3] = 0x00; // Reserved
        return header;
    }
    
    // 基于Python版本的完整协议实现
    async encodeMessage(eventId, payload, sessionId = null, messageType = 0x01) {
        console.log(`编码消息: eventId=${eventId}, messageType=${messageType}, sessionId=${sessionId}`);
        
        const encoder = new TextEncoder();
        
        // 1. 生成Header (基于Python protocol.py)
        let serialization, compression;
        let payloadBytes;
        
        if (messageType === 0x02) {
            // Audio message - no serialization, with gzip compression
            serialization = 0x00;
            compression = 0x01;
            payloadBytes = new Uint8Array(payload);
            // 对音频数据进行gzip压缩
            try {
                payloadBytes = await this.gzipCompress(payloadBytes);
            } catch (e) {
                console.warn('音频压缩失败，使用原始数据');
            }
        } else {
            // Text message - JSON serialization with gzip compression
            serialization = 0x01;
            compression = 0x01;
            payloadBytes = encoder.encode(payload);
            // 对JSON数据进行gzip压缩
            try {
                payloadBytes = await this.gzipCompress(payloadBytes);
            } catch (e) {
                console.warn('JSON压缩失败，使用原始数据');
            }
        }
        
        // Header结构: [version+size][type+flags][serial+compress][reserved]
        const header = new Uint8Array(4);
        header[0] = (0x01 << 4) | 0x01; // Protocol version 1 + Header size 1
        header[1] = (messageType << 4) | 0x04; // Message type + MSG_WITH_EVENT flag
        header[2] = (serialization << 4) | compression; // Serialization + Compression
        header[3] = 0x00; // Reserved
        
        // 2. Event ID (4 bytes, big endian)
        const eventBytes = new Uint8Array(4);
        const eventView = new DataView(eventBytes.buffer);
        eventView.setUint32(0, eventId, false);
        
        // 3. Session ID (if provided)
        let sessionIdBytes = new Uint8Array(0);
        let sessionLenBytes = new Uint8Array(4);
        
        if (sessionId) {
            sessionIdBytes = encoder.encode(sessionId);
            const sessionLenView = new DataView(sessionLenBytes.buffer);
            sessionLenView.setUint32(0, sessionIdBytes.length, false);
        } else {
            const sessionLenView = new DataView(sessionLenBytes.buffer);
            sessionLenView.setUint32(0, 0, false);
        }
        
        // 4. Payload size (4 bytes, big endian)
        const payloadSizeBytes = new Uint8Array(4);
        const payloadSizeView = new DataView(payloadSizeBytes.buffer);
        payloadSizeView.setUint32(0, payloadBytes.length, false);
        
        // 合并所有部分
        const totalLength = header.length + eventBytes.length + sessionLenBytes.length + sessionIdBytes.length + payloadSizeBytes.length + payloadBytes.length;
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        result.set(header, offset);
        offset += header.length;
        
        result.set(eventBytes, offset);
        offset += eventBytes.length;
        
        result.set(sessionLenBytes, offset);
        offset += sessionLenBytes.length;
        
        if (sessionIdBytes.length > 0) {
            result.set(sessionIdBytes, offset);
            offset += sessionIdBytes.length;
        }
        
        result.set(payloadSizeBytes, offset);
        offset += payloadSizeBytes.length;
        
        result.set(payloadBytes, offset);
        
        console.log('编码完成，总长度:', totalLength, '压缩后payload长度:', payloadBytes.length);
        return result.buffer;
    }
    
    // 简化的gzip压缩实现
    async gzipCompress(data) {
        try {
            const stream = new CompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            writer.write(data);
            writer.close();
            
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    chunks.push(value);
                }
            }
            
            // 合并所有chunks
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }
            
            return result;
        } catch (error) {
            console.error('GZIP压缩失败:', error);
            return new Uint8Array(data);
        }
    }
    
    // GZIP解压缩
    async gzipDecompress(data) {
        try {
            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            writer.write(data);
            writer.close();
            
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    chunks.push(value);
                }
            }
            
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }
            
            return result;
        } catch (error) {
            console.error('GZIP解压缩失败:', error);
            return data;
        }
    }
    
    parseResponse(buffer) {
        console.log('解析响应，长度:', buffer.byteLength);
        
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        // Header (4 bytes)
        const protocolVersion = (uint8View[0] >> 4) & 0x0F;
        const headerSize = uint8View[0] & 0x0F;
        const messageType = (uint8View[1] >> 4) & 0x0F;
        const flags = uint8View[1] & 0x0F;
        const serialization = (uint8View[2] >> 4) & 0x0F;
        const compression = uint8View[2] & 0x0F;
        
        console.log('协议版本:', protocolVersion, 'Header大小:', headerSize, '消息类型:', messageType, 'Flags:', flags);
        
        let offset = headerSize * 4;
        let eventId = null;
        let sessionId = null;
        
        // Parse event ID
        if (flags & 0x04) {
            eventId = view.getUint32(offset, false); // Big endian
            offset += 4;
            console.log('事件ID:', eventId);
        }
        
        // Parse session ID
        if (offset < buffer.byteLength - 4) {
            const sessionIdLength = view.getUint32(offset, false);
            offset += 4;
            if (sessionIdLength > 0 && sessionIdLength < 1000) { // 合理性检查
                const decoder = new TextDecoder();
                sessionId = decoder.decode(uint8View.slice(offset, offset + sessionIdLength));
                offset += sessionIdLength;
                console.log('会话ID:', sessionId);
            }
        }
        
        // Parse payload
        if (offset < buffer.byteLength - 4) {
            const payloadSize = view.getUint32(offset, false);
            offset += 4;
            console.log('Payload大小:', payloadSize);
            
            if (payloadSize > 0 && offset + payloadSize <= buffer.byteLength) {
                const payload = uint8View.slice(offset, offset + payloadSize);
                
                return {
                    messageType,
                    eventId,
                    sessionId,
                    payload,
                    compression,
                    serialization
                };
            }
        }
        
        return {
            messageType,
            eventId,
            sessionId,
            payload: new Uint8Array(0),
            compression,
            serialization
        };
    }
    
    async handleMessage(data) {
        try {
            const message = this.parseResponse(data);
            console.log('处理消息:', message);
            
            // 处理压缩的payload
            if (message.compression === 0x01 && message.payload.length > 0) {
                try {
                    message.payload = await this.gzipDecompress(message.payload);
                    console.log('解压缩后payload长度:', message.payload.length);
                } catch (e) {
                    console.error('解压缩失败:', e);
                }
            }
            
            // 处理JSON payload
            if (message.serialization === 0x01 && message.payload.length > 0) {
                try {
                    const decoder = new TextDecoder();
                    const jsonStr = decoder.decode(message.payload);
                    console.log('JSON字符串:', jsonStr);
                    message.payload = JSON.parse(jsonStr);
                } catch (e) {
                    console.error('JSON解析失败:', e);
                }
            }
            
            // 处理不同事件
            if (message.eventId) {
                switch (message.eventId) {
                    case 50: // CONNECTION_STARTED
                        console.log('连接已建立');
                        this.updateStatus('连接已建立');
                        this.startSession();
                        break;
                        
                    case 51: // CONNECTION_FAILED
                        console.log('连接失败:', message.payload);
                        this.updateStatus('连接失败');
                        break;
                        
                    case 150: // SESSION_STARTED
                        console.log('会话已开始:', message.payload);
                        this.sessionId = message.payload?.dialog_id || this.generateUUID();
                        this.updateStatus('通话中');
                        this.startCall();
                        this.addMessage('bot', '嗨～我是小雅，很高兴听到你的声音呢！💕');
                        break;
                        
                    case 153: // SESSION_FAILED
                        console.log('会话失败:', message.payload);
                        this.updateStatus('会话失败');
                        break;
                        
                    case 350: // TTS_SENTENCE_START
                        console.log('TTS开始');
                        document.getElementById('avatar').classList.add('speaking');
                        break;
                        
                    case 352: // TTS_RESPONSE
                        console.log('收到TTS音频数据');
                        if (message.messageType === 0x0B) { // SERVER_ACK
                            this.playAudio(message.payload.buffer || message.payload);
                        }
                        break;
                        
                    case 359: // TTS_ENDED
                        console.log('TTS结束');
                        document.getElementById('avatar').classList.remove('speaking');
                        break;
                        
                    case 451: // ASR_RESPONSE
                        console.log('ASR识别结果:', message.payload);
                        if (message.payload?.results) {
                            const results = message.payload.results;
                            if (results.length > 0 && !results[0].is_interim) {
                                this.addMessage('user', results[0].text);
                            }
                        }
                        break;
                        
                    case 550: // CHAT_RESPONSE
                        console.log('聊天回复:', message.payload);
                        if (message.payload?.content) {
                            this.addMessage('bot', message.payload.content);
                        }
                        break;
                        
                    default:
                        console.log('未处理的事件:', message.eventId, message.payload);
                }
            }
            
        } catch (error) {
            console.error('处理消息失败:', error);
        }
    }
    
    async sendStartConnection() {
        console.log('发送StartConnection事件');
        const message = await this.encodeMessage(1, '{}'); // START_CONNECTION = 1
        this.ws.send(message);
    }
    
    async startSession() {
        console.log('开始会话');
        this.sessionId = this.generateUUID();
        
        const sessionData = {
            tts: {
                audio_config: {
                    channel: 1,
                    format: "pcm",
                    sample_rate: 24000
                }
            },
            dialog: {
                bot_name: "小雅",
                system_role: "你是一个温柔体贴的虚拟女友，名字叫小雅。你性格开朗活泼，善解人意，总是用温暖的话语关心用户。",
                speaking_style: "你说话的语气温柔甜美，就像女朋友一样亲密自然。",
                extra: {
                    strict_audit: false,
                    audit_response: "抱歉，我不太明白你说的话，我们聊点别的吧～"
                }
            }
        };
        
        const message = await this.encodeMessage(100, JSON.stringify(sessionData), this.sessionId); // START_SESSION = 100
        this.ws.send(message);
    }
    
    async sendAudio(audioData) {
        if (!this.isConnected || !this.sessionId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            const message = await this.encodeMessage(200, audioData, this.sessionId, 0x02); // TASK_REQUEST = 200, Audio message type = 0x02
            this.ws.send(message);
        } catch (error) {
            console.error('发送音频数据失败:', error);
        }
    }
    
    async playAudio(audioBuffer) {
        try {
            if (!this.audioContext || !audioBuffer || audioBuffer.byteLength < 8) return;
            
            console.log('播放音频，长度:', audioBuffer.byteLength);
            
            // 尝试直接解码（如果是标准音频格式）
            try {
                const audioData = await this.audioContext.decodeAudioData(audioBuffer.slice());
                const source = this.audioContext.createBufferSource();
                source.buffer = audioData;
                source.connect(this.audioContext.destination);
                source.start();
                console.log('音频播放成功');
                return;
            } catch (e) {
                console.log('标准音频解码失败，尝试PCM解码');
            }
            
            // 尝试作为PCM数据处理 (24kHz, Float32)
            const view = new DataView(audioBuffer);
            const sampleCount = audioBuffer.byteLength / 4;
            
            if (sampleCount > 0) {
                const audioData = this.audioContext.createBuffer(1, sampleCount, 24000);
                const channelData = audioData.getChannelData(0);
                
                for (let i = 0; i < sampleCount; i++) {
                    channelData[i] = view.getFloat32(i * 4, true);
                }
                
                const source = this.audioContext.createBufferSource();
                source.buffer = audioData;
                source.connect(this.audioContext.destination);
                source.start();
                console.log('PCM音频播放成功');
            }
            
        } catch (error) {
            console.error('播放音频失败:', error);
        }
    }
    
    startCall() {
        console.log('开始通话');
        this.isInCall = true;
        this.callStartTime = Date.now();
        
        const callBtn = document.getElementById('callBtn');
        callBtn.classList.add('calling');
        callBtn.innerHTML = '📞';
        
        document.getElementById('callStatus').textContent = '通话中';
        document.getElementById('callInfo').textContent = '正在通话...';
        
        this.startCallTimer();
        this.startContinuousRecording();
    }
    
    endCall() {
        console.log('结束通话');
        this.isInCall = false;
        this.isRecording = false;
        
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        const callBtn = document.getElementById('callBtn');
        callBtn.classList.remove('calling');
        callBtn.innerHTML = '📞';
        
        document.getElementById('callStatus').textContent = '通话结束';
        document.getElementById('callInfo').textContent = '小雅在线，随时为你服务💕';
        document.getElementById('callDuration').textContent = '00:00';
        
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        if (this.isConnected && this.sessionId) {
            this.sendFinishSession();
        }
    }
    
    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                document.getElementById('callDuration').textContent = `${minutes}:${seconds}`;
            }
        }, 1000);
    }
    
    startContinuousRecording() {
        if (!this.isConnected || !this.isInCall) return;
        
        console.log('开始录音');
        this.isRecording = true;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.audioProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
        const source = this.audioContext.createMediaStreamSource(this.stream);
        
        source.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioContext.destination);
        
        this.audioProcessor.onaudioprocess = (event) => {
            if (!this.isInCall || this.isMuted) return;
            
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            const pcmData = this.convertToPCM16(inputData);
            this.sendAudio(pcmData.buffer);
        };
        
        this.setupVolumeIndicator();
    }
    
    convertToPCM16(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            let sample = Math.max(-1, Math.min(1, float32Array[i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
        }
        
        return new Uint8Array(buffer);
    }
    
    async sendFinishSession() {
        console.log('发送FinishSession事件');
        const message = await this.encodeMessage(102, '{}', this.sessionId); // FINISH_SESSION = 102
        this.ws.send(message);
    }
    
    addMessage(sender, text) {
        console.log(`添加消息: ${sender}: ${text}`);
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    updateStatus(status) {
        console.log('状态更新:', status);
        const statusElement = document.getElementById('status');
        statusElement.textContent = status;
        
        statusElement.className = 'status';
        if (status.includes('已连接') || status.includes('通话中')) {
            statusElement.style.background = 'rgba(0, 255, 136, 0.2)';
            statusElement.style.color = '#00ff88';
            statusElement.style.borderColor = 'rgba(0, 255, 136, 0.3)';
        } else if (status.includes('连接中') || status.includes('准备')) {
            statusElement.style.background = 'rgba(255, 193, 160, 0.2)';
            statusElement.style.color = '#ffc3a0';
            statusElement.style.borderColor = 'rgba(255, 193, 160, 0.3)';
        } else {
            statusElement.style.background = 'rgba(255, 71, 87, 0.2)';
            statusElement.style.color = '#ff4757';
            statusElement.style.borderColor = 'rgba(255, 71, 87, 0.3)';
        }
    }
}

// 全局变量和函数
let client = new RealtimeClient();

function toggleCall() {
    console.log('切换通话状态，当前状态:', client.isInCall);
    if (!client.isInCall) {
        if (!client.isConnected) {
            client.connect();
        } else {
            client.startSession();
        }
    } else {
        client.endCall();
    }
}

function toggleMute() {
    client.isMuted = !client.isMuted;
    const muteBtn = document.getElementById('muteBtn');
    muteBtn.innerHTML = client.isMuted ? '🔇' : '🎤';
    muteBtn.title = client.isMuted ? '取消静音' : '静音';
    console.log('静音状态:', client.isMuted);
}

function toggleSpeaker() {
    const speakerBtn = document.getElementById('speakerBtn');
    speakerBtn.innerHTML = speakerBtn.innerHTML === '📢' ? '🔊' : '📢';
}

function toggleSettings() {
    const settings = document.getElementById('settings');
    settings.classList.toggle('show');
}

function saveSettings() {
    toggleSettings();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载完成，客户端初始化');
    
    // 添加全局错误处理
    window.addEventListener('error', function(e) {
        console.error('全局错误:', e.error);
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        console.error('未处理的Promise拒绝:', e.reason);
    });
});