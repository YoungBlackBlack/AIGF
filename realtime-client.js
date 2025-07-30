class RealtimeClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isRecording = false;
        this.audioContext = null;
        this.mediaRecorder = null;
        this.stream = null;
        this.sessionId = null;
        this.connectId = this.generateUUID();
        this.callStartTime = null;
        this.callTimer = null;
        this.isInCall = false;
        this.isMuted = false;
        
        // API配置
        this.config = {
            appId: '9047255535',
            accessKey: '8YrYKqRMJmIYslYKYhBoxki-yhHnYN7U',
            url: 'ws://localhost:8080'  // 使用本地代理服务器
        };
        
        // 事件ID定义
        this.events = {
            START_CONNECTION: 1,
            FINISH_CONNECTION: 2,
            START_SESSION: 100,
            FINISH_SESSION: 102,
            TASK_REQUEST: 200,
            SAY_HELLO: 300,
            CHAT_TTS_TEXT: 500,
            
            CONNECTION_STARTED: 50,
            CONNECTION_FAILED: 51,
            CONNECTION_FINISHED: 52,
            SESSION_STARTED: 150,
            SESSION_FINISHED: 152,
            SESSION_FAILED: 153,
            TTS_SENTENCE_START: 350,
            TTS_SENTENCE_END: 351,
            TTS_RESPONSE: 352,
            TTS_ENDED: 359,
            ASR_INFO: 450,
            ASR_RESPONSE: 451,
            ASR_ENDED: 459,
            CHAT_RESPONSE: 550,
            CHAT_ENDED: 559
        };
        
        this.loadSettings();
        this.initAudio();
    }
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    loadSettings() {
        const saved = localStorage.getItem('realtimeSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            this.config.appId = settings.appId || '';
            this.config.accessKey = settings.accessKey || '';
            
            document.getElementById('appId').value = this.config.appId;
            document.getElementById('accessKey').value = this.config.accessKey;
        }
    }
    
    saveSettings() {
        this.config.appId = document.getElementById('appId').value;
        this.config.accessKey = document.getElementById('accessKey').value;
        
        localStorage.setItem('realtimeSettings', JSON.stringify({
            appId: this.config.appId,
            accessKey: this.config.accessKey
        }));
        
        this.updateStatus('设置已保存');
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
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            const volumePercent = (average / 255) * 100;
            
            document.getElementById('volumeBar').style.width = volumePercent + '%';
            
            if (this.isRecording) {
                requestAnimationFrame(updateVolume);
            }
        };
        
        updateVolume();
    }
    
    connect() {
        this.updateStatus('连接中...');
        
        // 通过代理服务器连接，将认证信息作为URL参数传递
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
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('连接错误');
        };
    }
    
    // 二进制协议编码
    encodeMessage(messageType, flags, eventId, payload, sessionId = null, connectId = null) {
        const encoder = new TextEncoder();
        
        // 计算可选字段大小
        let optionalSize = 0;
        let actualFlags = flags;
        
        // 根据参数确定实际flags
        if (eventId !== null) {
            actualFlags |= 0x04; // Has event
            optionalSize += 4;
        }
        
        if (connectId) {
            optionalSize += 4; // connect id size
            optionalSize += connectId.length; // connect id
        }
        
        if (sessionId) {
            optionalSize += 4; // session id size  
            optionalSize += sessionId.length; // session id
        }
        
        // 编码payload
        let payloadBuffer;
        let serializationMethod = 0x00; // Raw
        
        if (typeof payload === 'string') {
            payloadBuffer = encoder.encode(payload);
            serializationMethod = 0x01; // JSON
        } else if (payload instanceof ArrayBuffer) {
            payloadBuffer = new Uint8Array(payload);
            serializationMethod = 0x00; // Raw
        } else {
            payloadBuffer = new Uint8Array(0);
            serializationMethod = 0x01; // JSON
        }
        
        // 创建完整消息
        const totalSize = 4 + optionalSize + 4 + payloadBuffer.length;
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        let offset = 0;
        
        // Header (4 bytes)
        view.setUint8(offset++, 0x11); // Protocol version (0001) + Header size (0001)  
        view.setUint8(offset++, (messageType << 4) | actualFlags);
        view.setUint8(offset++, (serializationMethod << 4) | 0x00); // Serialization + No compression
        view.setUint8(offset++, 0x00); // Reserved
        
        // Event ID (如果有)
        if (eventId !== null) {
            view.setUint32(offset, eventId, false); // Big endian
            offset += 4;
        }
        
        // Connect ID (如果有)
        if (connectId) {
            view.setUint32(offset, connectId.length, false);
            offset += 4;
            uint8View.set(encoder.encode(connectId), offset);
            offset += connectId.length;
        }
        
        // Session ID (如果有)
        if (sessionId) {
            view.setUint32(offset, sessionId.length, false);
            offset += 4;
            uint8View.set(encoder.encode(sessionId), offset);
            offset += sessionId.length;
        }
        
        // Payload size
        view.setUint32(offset, payloadBuffer.length, false);
        offset += 4;
        
        // Payload
        uint8View.set(payloadBuffer, offset);
        
        return buffer;
    }
    
    // 二进制协议解码
    decodeMessage(buffer) {
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        let offset = 0;
        
        // Header
        const header1 = view.getUint8(offset++);
        const header2 = view.getUint8(offset++);
        const header3 = view.getUint8(offset++);
        const header4 = view.getUint8(offset++);
        
        const messageType = (header2 >> 4) & 0x0F;
        const flags = header2 & 0x0F;
        const serialization = (header3 >> 4) & 0x0F;
        
        let sequence = null;
        let eventId = null;
        let connectId = null;
        let sessionId = null;
        
        // Parse optional fields
        if (flags & 0x01) { // Has sequence
            sequence = view.getUint32(offset, false);
            offset += 4;
        }
        
        if (flags & 0x04) { // Has event
            eventId = view.getUint32(offset, false);
            offset += 4;
        }
        
        if (offset < buffer.byteLength - 4) {
            // Check for connect id (only for connection events)
            if (eventId === this.events.CONNECTION_STARTED || eventId === this.events.CONNECTION_FAILED) {
                const connectIdSize = view.getUint32(offset, false);
                offset += 4;
                if (connectIdSize > 0) {
                    connectId = new TextDecoder().decode(uint8View.slice(offset, offset + connectIdSize));
                    offset += connectIdSize;
                }
            }
            
            // Check for session id
            if (offset < buffer.byteLength - 4) {
                const sessionIdSize = view.getUint32(offset, false);
                offset += 4;
                if (sessionIdSize > 0) {
                    sessionId = new TextDecoder().decode(uint8View.slice(offset, offset + sessionIdSize));
                    offset += sessionIdSize;
                }
            }
        }
        
        // Payload size and data
        const payloadSize = view.getUint32(offset, false);
        offset += 4;
        
        let payload = null;
        if (payloadSize > 0) {
            const payloadBuffer = uint8View.slice(offset, offset + payloadSize);
            
            if (serialization === 1) { // JSON
                payload = JSON.parse(new TextDecoder().decode(payloadBuffer));
            } else { // Binary
                payload = payloadBuffer.buffer;
            }
        }
        
        return {
            messageType,
            flags,
            eventId,
            sessionId,
            connectId,
            payload
        };
    }
    
    handleMessage(data) {
        const message = this.decodeMessage(data);
        
        switch (message.eventId) {
            case this.events.CONNECTION_STARTED:
                this.updateStatus('连接已建立');
                this.startSession();
                break;
                
            case this.events.CONNECTION_FAILED:
                this.updateStatus('连接失败: ' + (message.payload?.error || '未知错误'));
                break;
                
            case this.events.SESSION_STARTED:
                this.sessionId = message.payload?.dialog_id || this.generateUUID();
                this.updateStatus('通话中');
                this.startCall();
                this.addMessage('bot', '嗨～我是小雅，很高兴听到你的声音呢！💕');
                break;
                
            case this.events.SESSION_FAILED:
                this.updateStatus('会话失败: ' + (message.payload?.error || '未知错误'));
                break;
                
            case this.events.ASR_RESPONSE:
                const results = message.payload?.results;
                if (results && results.length > 0) {
                    const text = results[0].text;
                    const isInterim = results[0].is_interim;
                    
                    if (!isInterim && text) {
                        this.addMessage('user', text);
                    }
                }
                break;
                
            case this.events.TTS_SENTENCE_START:
                document.getElementById('avatar').classList.add('speaking');
                break;
                
            case this.events.TTS_RESPONSE:
                this.playAudio(message.payload);
                break;
                
            case this.events.TTS_ENDED:
                document.getElementById('avatar').classList.remove('speaking');
                break;
                
            case this.events.CHAT_RESPONSE:
                if (message.payload?.content) {
                    this.addMessage('bot', message.payload.content);
                }
                break;
                
            case this.events.ASR_INFO:
                // 检测到说话开始，可以在这里添加UI反馈
                break;
                
            case this.events.ASR_ENDED:
                // 用户说话结束
                break;
        }
    }
    
    sendStartConnection() {
        const message = this.encodeMessage(
            0x01, // Full-client request
            0x00, // No additional flags, will be set by encodeMessage
            this.events.START_CONNECTION,
            '{}',
            null,
            this.connectId
        );
        
        this.ws.send(message);
    }
    
    startSession() {
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
                system_role: "你是一个温柔体贴的虚拟女友，名字叫小雅。你性格开朗活泼，善解人意，总是用温暖的话语关心用户。你喜欢用可爱的语气说话，经常使用emoji表情，让用户感受到被爱和被关心的感觉。",
                speaking_style: "你说话的语气温柔甜美，就像女朋友一样亲密自然。你会关心用户的生活，倾听用户的烦恼，给予温暖的安慰和鼓励。",
                extra: {
                    strict_audit: false,
                    audit_response: "抱歉，我不太明白你说的话，我们聊点别的吧～"
                }
            }
        };
        
        const message = this.encodeMessage(
            0x01, // Full-client request
            0x00, // No additional flags, will be set by encodeMessage
            this.events.START_SESSION,
            JSON.stringify(sessionData),
            this.sessionId
        );
        
        this.ws.send(message);
    }
    
    sendAudio(audioData) {
        if (!this.isConnected || !this.sessionId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            const message = this.encodeMessage(
                0x02, // Audio-only request
                0x00, // No additional flags, will be set by encodeMessage
                this.events.TASK_REQUEST,
                audioData,
                this.sessionId
            );
            
            this.ws.send(message);
        } catch (error) {
            console.error('发送音频数据失败:', error);
        }
    }
    
    async playAudio(audioBuffer) {
        try {
            if (!this.audioContext) return;
            
            // 根据StartSession配置，服务端应该返回PCM格式音频
            // PCM格式：单声道、24000Hz采样率、Float32采样点、小端序
            if (audioBuffer.byteLength < 8) {
                console.warn('音频数据太短，跳过播放');
                return;
            }
            
            // 解析PCM数据
            const view = new DataView(audioBuffer);
            const sampleCount = audioBuffer.byteLength / 4; // Float32 = 4 bytes per sample
            
            // 创建AudioBuffer
            const audioData = this.audioContext.createBuffer(1, sampleCount, 24000);
            const channelData = audioData.getChannelData(0);
            
            // 读取Float32数据
            for (let i = 0; i < sampleCount; i++) {
                channelData[i] = view.getFloat32(i * 4, true); // 小端序
            }
            
            // 播放音频
            const source = this.audioContext.createBufferSource();
            source.buffer = audioData;
            source.connect(this.audioContext.destination);
            source.start();
            
        } catch (error) {
            console.error('播放音频失败:', error);
            console.log('音频数据长度:', audioBuffer.byteLength);
            
            // 尝试作为普通音频格式解码
            try {
                const audioData = await this.audioContext.decodeAudioData(audioBuffer.slice());
                const source = this.audioContext.createBufferSource();
                source.buffer = audioData;
                source.connect(this.audioContext.destination);
                source.start();
            } catch (fallbackError) {
                console.error('备用音频解码也失败:', fallbackError);
            }
        }
    }
    
    startCall() {
        this.isInCall = true;
        this.callStartTime = Date.now();
        
        // Update UI
        const callBtn = document.getElementById('callBtn');
        callBtn.classList.add('calling');
        callBtn.innerHTML = '📞';
        
        document.getElementById('callStatus').textContent = '通话中';
        document.getElementById('callInfo').textContent = '正在通话...';
        
        // Start call timer
        this.startCallTimer();
        this.startContinuousRecording();
    }
    
    endCall() {
        this.isInCall = false;
        this.isRecording = false;
        
        // Stop timers
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        // Update UI
        const callBtn = document.getElementById('callBtn');
        callBtn.classList.remove('calling');
        callBtn.innerHTML = '📞';
        
        document.getElementById('callStatus').textContent = '通话结束';
        document.getElementById('callInfo').textContent = '点击开始语音对话';
        document.getElementById('callDuration').textContent = '00:00';
        
        // Stop audio processing
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        // Send finish session
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
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // 使用ScriptProcessorNode处理音频数据（实时处理）
        this.audioProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
        const source = this.audioContext.createMediaStreamSource(this.stream);
        
        source.connect(this.audioProcessor);
        this.audioProcessor.connect(this.audioContext.destination);
        
        this.audioProcessor.onaudioprocess = (event) => {
            if (!this.isInCall || this.isMuted) return;
            
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            // 检测音频活动度（避免发送过多静音）
            const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
            
            // 转换为16位PCM格式
            const pcmData = this.convertToPCM16(inputData);
            
            // 总是发送音频数据以保持连接（包括静音）
            this.sendAudio(pcmData.buffer);
        };
        this.setupVolumeIndicator();
    }
    
    // 将Float32音频数据转换为16位PCM
    convertToPCM16(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            let sample = Math.max(-1, Math.min(1, float32Array[i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true); // 小端序
        }
        
        return new Uint8Array(buffer);
    }
    
    sendFinishSession() {
        const message = this.encodeMessage(
            0x01, // Full-client request
            0x00, // No additional flags, will be set by encodeMessage
            this.events.FINISH_SESSION,
            '{}',
            this.sessionId
        );
        
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
        
        // Update status color based on connection state
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

function toggleSettings() {
    const settings = document.getElementById('settings');
    settings.classList.toggle('show');
}

function saveSettings() {
    client.saveSettings();
    toggleSettings();
}

function toggleCall() {
    if (!client.isInCall) {
        // Start call
        if (!client.isConnected) {
            client.connect();
        } else {
            client.startSession();
        }
    } else {
        // End call
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
    // This is a placeholder for speaker toggle functionality
    const speakerBtn = document.getElementById('speakerBtn');
    speakerBtn.innerHTML = speakerBtn.innerHTML === '📢' ? '🔊' : '📢';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 自动连接（如果已配置密钥）
    if (client.config.appId && client.config.accessKey) {
        setTimeout(() => client.connect(), 1000);
    }
});

// 处理连接状态变化
client.ws?.addEventListener('close', () => {
    if (client.isInCall) {
        client.endCall();
    }
    client.updateStatus('连接已断开');
});