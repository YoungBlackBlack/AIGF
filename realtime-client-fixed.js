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
        
        // API配置
        this.config = {
            appId: '9047255535',
            accessKey: '8YrYKqRMJmIYslYKYhBoxki-yhHnYN7U',
            url: 'ws://localhost:8080'
        };
        
        // 事件ID定义
        this.events = {
            START_CONNECTION: 1,
            FINISH_CONNECTION: 2,
            START_SESSION: 100,
            FINISH_SESSION: 102,
            TASK_REQUEST: 200,
            SAY_HELLO: 300,
            CHAT_TTS_TEXT: 500
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
            
        } catch (error) {
            console.error('Failed to initialize audio:', error);
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
        
        const wsUrl = `${this.config.url}?` + new URLSearchParams({
            appId: this.config.appId,
            accessKey: this.config.accessKey,
            connectId: this.connectId
        }).toString();
        
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.updateStatus('已连接');
            this.sendStartConnection();
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            this.updateStatus('连接已断开');
            if (this.isInCall) {
                this.endCall();
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('连接错误');
        };
    }
    
    // 基于Python代码的正确协议实现
    generateHeader(messageType = 0x01, flags = 0x04, serialization = 0x01, compression = 0x01) {
        const header = new Uint8Array(4);
        header[0] = (0x01 << 4) | 0x01; // Protocol version (0001) + Header size (0001)
        header[1] = (messageType << 4) | flags; // Message type + flags
        header[2] = (serialization << 4) | compression; // JSON + GZIP
        header[3] = 0x00; // Reserved
        return header;
    }
    
    async encodeMessage(eventId, payload, sessionId = null, messageType = 0x01, useCompression = true) {
        const encoder = new TextEncoder();
        
        // 编码payload
        let payloadBytes;
        if (typeof payload === 'string') {
            payloadBytes = encoder.encode(payload);
        } else if (payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
            payloadBytes = new Uint8Array(payload);
        } else {
            payloadBytes = encoder.encode('{}');
        }
        
        // 压缩payload（如果需要）
        if (useCompression && typeof payload === 'string') {
            payloadBytes = await this.gzipCompress(payloadBytes);
        }
        
        // 构建消息
        const header = this.generateHeader(messageType, 0x04, messageType === 0x02 ? 0x00 : 0x01, useCompression ? 0x01 : 0x00);
        
        // 计算总大小
        let totalSize = header.length + 4; // header + event
        if (sessionId) {
            totalSize += 4 + sessionId.length; // session id size + session id
        }
        totalSize += 4 + payloadBytes.length; // payload size + payload
        
        // 构建完整消息
        const message = new Uint8Array(totalSize);
        let offset = 0;
        
        // Header
        message.set(header, offset);
        offset += header.length;
        
        // Event ID
        const view = new DataView(message.buffer);
        view.setUint32(offset, eventId, false); // Big endian
        offset += 4;
        
        // Session ID (if provided)
        if (sessionId) {
            const sessionBytes = encoder.encode(sessionId);
            view.setUint32(offset, sessionBytes.length, false);
            offset += 4;
            message.set(sessionBytes, offset);
            offset += sessionBytes.length;
        }
        
        // Payload size and data
        view.setUint32(offset, payloadBytes.length, false);
        offset += 4;
        message.set(payloadBytes, offset);
        
        return message.buffer;
    }
    
    // 简单的gzip压缩实现
    async gzipCompress(data) {
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
    }
    
    // 解析服务器响应
    parseResponse(buffer) {
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        // Header
        const protocolVersion = (uint8View[0] >> 4) & 0x0F;
        const headerSize = uint8View[0] & 0x0F;
        const messageType = (uint8View[1] >> 4) & 0x0F;
        const flags = uint8View[1] & 0x0F;
        const serialization = (uint8View[2] >> 4) & 0x0F;
        const compression = uint8View[2] & 0x0F;
        
        let offset = headerSize * 4;
        let eventId = null;
        let sessionId = null;
        
        // Parse event ID
        if (flags & 0x04) {
            eventId = view.getUint32(offset, false); // Big endian
            offset += 4;
        }
        
        // Parse session ID
        if (offset < buffer.byteLength - 4) {
            const sessionIdLength = view.getUint32(offset, false);
            offset += 4;
            if (sessionIdLength > 0) {
                const decoder = new TextDecoder();
                sessionId = decoder.decode(uint8View.slice(offset, offset + sessionIdLength));
                offset += sessionIdLength;
            }
        }
        
        // Parse payload
        const payloadSize = view.getUint32(offset, false);
        offset += 4;
        let payload = uint8View.slice(offset, offset + payloadSize);
        
        return {
            messageType,
            eventId,
            sessionId,
            payload,
            compression,
            serialization
        };
    }
    
    async handleMessage(data) {
        try {
            const message = this.parseResponse(data);
            
            // 解压缩payload
            if (message.compression === 0x01 && message.payload.length > 0) {
                try {
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    
                    writer.write(message.payload);
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
                    const decompressed = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        decompressed.set(chunk, offset);
                        offset += chunk.length;
                    }
                    
                    message.payload = decompressed;
                } catch (e) {
                    console.error('解压缩失败:', e);
                }
            }
            
            // 解析JSON payload
            if (message.serialization === 0x01 && message.payload.length > 0) {
                try {
                    const decoder = new TextDecoder();
                    const jsonStr = decoder.decode(message.payload);
                    message.payload = JSON.parse(jsonStr);
                } catch (e) {
                    console.error('JSON解析失败:', e);
                }
            }
            
            console.log('收到服务器消息:', message);
            
            // 处理不同事件
            switch (message.eventId) {
                case 50: // CONNECTION_STARTED
                    this.updateStatus('连接已建立');
                    this.startSession();
                    break;
                    
                case 51: // CONNECTION_FAILED
                    this.updateStatus('连接失败: ' + (message.payload?.error || '未知错误'));
                    break;
                    
                case 150: // SESSION_STARTED
                    this.sessionId = message.payload?.dialog_id || this.generateUUID();
                    this.updateStatus('通话中');
                    this.startCall();
                    this.addMessage('bot', '嗨～我是小雅，很高兴听到你的声音呢！💕');
                    break;
                    
                case 153: // SESSION_FAILED
                    this.updateStatus('会话失败: ' + (message.payload?.error || '未知错误'));
                    break;
                    
                case 350: // TTS_SENTENCE_START
                    document.getElementById('avatar').classList.add('speaking');
                    break;
                    
                case 352: // TTS_RESPONSE
                    if (message.messageType === 0x0B) { // SERVER_ACK (音频数据)
                        this.playAudio(message.payload.buffer);
                    }
                    break;
                    
                case 359: // TTS_ENDED
                    document.getElementById('avatar').classList.remove('speaking');
                    break;
                    
                case 451: // ASR_RESPONSE
                    if (message.payload?.results) {
                        const results = message.payload.results;
                        if (results.length > 0 && !results[0].is_interim) {
                            this.addMessage('user', results[0].text);
                        }
                    }
                    break;
                    
                case 550: // CHAT_RESPONSE
                    if (message.payload?.content) {
                        this.addMessage('bot', message.payload.content);
                    }
                    break;
            }
            
        } catch (error) {
            console.error('处理消息失败:', error);
        }
    }
    
    async sendStartConnection() {
        const message = await this.encodeMessage(this.events.START_CONNECTION, '{}');
        this.ws.send(message);
    }
    
    async startSession() {
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
        
        const message = await this.encodeMessage(this.events.START_SESSION, JSON.stringify(sessionData), this.sessionId);
        this.ws.send(message);
    }
    
    async sendAudio(audioData) {
        if (!this.isConnected || !this.sessionId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            const message = await this.encodeMessage(this.events.TASK_REQUEST, audioData, this.sessionId, 0x02, true);
            this.ws.send(message);
        } catch (error) {
            console.error('发送音频数据失败:', error);
        }
    }
    
    async playAudio(audioBuffer) {
        try {
            if (!this.audioContext || !audioBuffer || audioBuffer.byteLength < 8) return;
            
            // 解析PCM数据 (24kHz, Float32, 单声道)
            const view = new DataView(audioBuffer);
            const sampleCount = audioBuffer.byteLength / 4;
            
            const audioData = this.audioContext.createBuffer(1, sampleCount, 24000);
            const channelData = audioData.getChannelData(0);
            
            for (let i = 0; i < sampleCount; i++) {
                channelData[i] = view.getFloat32(i * 4, true);
            }
            
            const source = this.audioContext.createBufferSource();
            source.buffer = audioData;
            source.connect(this.audioContext.destination);
            source.start();
            
        } catch (error) {
            console.error('播放音频失败:', error);
        }
    }
    
    startCall() {
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
        const message = await this.encodeMessage(this.events.FINISH_SESSION, '{}', this.sessionId);
        this.ws.send(message);
    }
    
    addMessage(sender, text) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = text;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    updateStatus(status) {
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
    // 自动连接（延迟一秒确保UI加载完成）
    setTimeout(() => {
        if (client.config.appId && client.config.accessKey) {
            // 不自动连接，等用户点击通话按钮
            console.log('客户端初始化完成，等待用户开始通话');
        }
    }, 1000);
});