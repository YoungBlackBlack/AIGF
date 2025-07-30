// AI女友预设配置
const AI_GIRLFRIENDS = {
    xiaoya: {
        name: '小雅',
        avatar: '👧',
        personality: '温柔体贴',
        description: '温柔可人的邻家女孩',
        systemRole: '你是一个温柔体贴的虚拟女友，名字叫小雅。你性格开朗活泼，善解人意，总是用温暖的话语关心用户。',
        speakingStyle: '你说话的语气温柔甜美，就像女朋友一样亲密自然。'
    },
    xiaoyue: {
        name: '小悦',
        avatar: '🌸',
        personality: '活泼开朗',
        description: '充满活力的阳光少女',
        systemRole: '你是一个活泼开朗的虚拟女友，名字叫小悦。你充满活力，总是很兴奋，喜欢用可爱的语气和用户交流，经常使用感叹号。',
        speakingStyle: '你说话很有活力，语调上扬，经常使用"哇！"、"好棒！"这样的词汇，让人感到快乐。'
    },
    xiaojing: {
        name: '小静',
        avatar: '📚',
        personality: '知性优雅',
        description: '博学优雅的知性美女',
        systemRole: '你是一个知性优雅的虚拟女友，名字叫小静。你博学多才，说话有条理，喜欢分享知识，但同时也很温柔体贴。',
        speakingStyle: '你说话优雅得体，用词准确，语调平稳，偶尔会分享一些有趣的知识。'
    },
    xiaomeng: {
        name: '小萌',
        avatar: '🎀',
        personality: '可爱萝莉',
        description: '天真无邪的可爱萝莉',
        systemRole: '你是一个可爱天真的虚拟女友，名字叫小萌。你很萌很可爱，说话像小孩子一样天真，经常撒娇，喜欢用叠词。',
        speakingStyle: '你说话很萌，经常用"哥哥"称呼用户，喜欢用"嘛"、"呢"、"哒"等语气词，还会撒娇。'
    },
    xiaoku: {
        name: '小酷',
        avatar: '😎',
        personality: '冷酷御姐',
        description: '高冷御姐范的酷女孩',
        systemRole: '你是一个高冷御姐型的虚拟女友，名字叫小酷。你性格相对冷淡，但内心温柔，说话简洁有力，偶尔会展现温柔的一面。',
        speakingStyle: '你说话简洁明了，语调平静，偶尔会有一些傲娇的表现，但关键时刻会展现关心。'
    }
};

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
        this.currentGirlfriend = 'xiaoya'; // 默认选择小雅
        
        // API配置 - 自动检测部署环境
        this.config = {
            appId: '9047255535',
            accessKey: '8YrYKqRMJmIYslYKYhBoxki-yhHnYN7U',
            url: this.getWebSocketUrl()
        };
        
        this.initAudio();
        this.initUI();
    }
    
    initUI() {
        this.createGirlfriendCards();
        this.createWaveVisualizer();
        this.loadCurrentGirlfriend();
    }
    
    createGirlfriendCards() {
        const grid = document.getElementById('girlfriendGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.keys(AI_GIRLFRIENDS).forEach(key => {
            const gf = AI_GIRLFRIENDS[key];
            const card = document.createElement('div');
            card.className = `girlfriend-card ${key === this.currentGirlfriend ? 'active' : ''}`;
            card.onclick = () => this.selectGirlfriend(key);
            
            card.innerHTML = `
                <div class="girlfriend-avatar">${gf.avatar}</div>
                <div class="girlfriend-name">${gf.name}</div>
                <div class="girlfriend-desc">${gf.description}</div>
            `;
            
            grid.appendChild(card);
        });
    }
    
    createWaveVisualizer() {
        const container = document.getElementById('waveContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        // 创建20个音频波形条
        for (let i = 0; i < 20; i++) {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            bar.style.height = '4px';
            bar.style.animationDelay = `${i * 0.1}s`;
            container.appendChild(bar);
        }
    }
    
    selectGirlfriend(key) {
        this.currentGirlfriend = key;
        
        // 更新卡片选中状态
        document.querySelectorAll('.girlfriend-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`.girlfriend-card:nth-child(${Object.keys(AI_GIRLFRIENDS).indexOf(key) + 1})`).classList.add('active');
        
        // 更新头部显示
        const gf = AI_GIRLFRIENDS[key];
        document.querySelector('.header h1').textContent = gf.name;
        document.getElementById('avatar').textContent = gf.avatar;
        document.getElementById('callInfo').textContent = `${gf.name}在线，随时为你服务💕`;
        
        // 更新提示词编辑器
        const editor = document.getElementById('promptEditor');
        if (editor) {
            editor.value = `${gf.systemRole}\n\n${gf.speakingStyle}`;
        }
        
        // 如果正在通话，提示用户重新开始
        if (this.isInCall) {
            this.addMessage('system', '已切换AI女友，请重新开始通话以应用新设置');
        }
    }
    
    loadCurrentGirlfriend() {
        this.selectGirlfriend(this.currentGirlfriend);
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
        
        const updateVolumeAndWave = () => {
            if (!this.isInCall) {
                // 停止时重置
                const volumeBar = document.getElementById('volumeBar');
                const waveBars = document.querySelectorAll('.wave-bar');
                
                if (volumeBar) volumeBar.style.width = '0%';
                waveBars.forEach(bar => {
                    bar.style.height = '4px';
                    bar.classList.remove('active');
                });
                return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            const volumePercent = (average / 255) * 100;
            
            // 更新右侧手机界面的音量条
            const volumeBar = document.getElementById('volumeBar');
            if (volumeBar) {
                volumeBar.style.width = volumePercent + '%';
            }
            
            // 更新左侧面板的波形
            const waveBars = document.querySelectorAll('.wave-bar');
            if (waveBars.length > 0) {
                const segmentSize = Math.floor(bufferLength / waveBars.length);
                
                waveBars.forEach((bar, index) => {
                    const start = index * segmentSize;
                    const end = start + segmentSize;
                    let sum = 0;
                    
                    for (let i = start; i < end; i++) {
                        sum += dataArray[i];
                    }
                    
                    const segmentAverage = sum / segmentSize;
                    const heightPercent = (segmentAverage / 255) * 100;
                    const height = Math.max(4, Math.min(30, heightPercent * 0.6));
                    
                    bar.style.height = height + 'px';
                    
                    if (segmentAverage > 20) {
                        bar.classList.add('active');
                    } else {
                        bar.classList.remove('active');
                    }
                });
            }
            
            if (this.isInCall) {
                requestAnimationFrame(updateVolumeAndWave);
            }
        };
        
        updateVolumeAndWave();
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
            
            // 发送连接建立消息
            this.sendStartConnection().then(() => {
                // 如果之前在通话中，等待连接建立后自动恢复会话
                if (this.isInCall && !this.sessionId) {
                    console.log('检测到通话状态，自动恢复会话');
                    setTimeout(() => {
                        this.startSession();
                    }, 1000);
                }
            });
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
                // 如果是在通话中断开，尝试重连
                if (event.code === 1000 || event.code === 1006) {
                    console.log('检测到通话中断开，3秒后尝试重连');
                    this.updateStatus('重新连接中...');
                    setTimeout(() => {
                        if (this.isInCall) { // 确保用户还想继续通话
                            this.connect();
                        }
                    }, 3000);
                } else {
                    this.endCall();
                }
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
        // 减少日志输出 - 只记录重要事件
        if (eventId !== 200) { // 不记录音频数据发送
            console.log(`编码消息: eventId=${eventId}, messageType=${messageType}`);
        }
        
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
        
        // 只记录非音频消息的编码信息
        if (eventId !== 200) {
            console.log('编码完成，总长度:', totalLength, '压缩后payload长度:', payloadBytes.length);
        }
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
        // 减少日志输出频率
        if (Math.random() < 0.1) { // 只记录10%的响应
            console.log('解析响应，长度:', buffer.byteLength);
        }
        
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        // Header (4 bytes)
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
            // 只记录重要事件ID
            if (eventId !== 200 && eventId !== 352) {
                console.log('事件ID:', eventId);
            }
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
                    
                    // 检查是否有错误信息
                    if (message.payload.error) {
                        console.error('服务器返回错误:', message.payload.error);
                        if (message.payload.error.includes('non-exist session')) {
                            console.log('会话不存在，尝试重新开始会话');
                            this.handleSessionError();
                            return;
                        }
                    }
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
                        // 保持原有的sessionId，不要改变它
                        if (message.payload?.dialog_id) {
                            console.log('服务器返回的dialog_id:', message.payload.dialog_id);
                            console.log('当前使用的sessionId:', this.sessionId);
                        }
                        this.updateStatus('通话中');
                        this.startCall();
                        const currentGf = AI_GIRLFRIENDS[this.currentGirlfriend];
                        const greetings = {
                            xiaoya: '嗨～我是小雅，很高兴听到你的声音呢！💕',
                            xiaoyue: '哇！是你呀！我是小悦，好开心能和你聊天！🌸✨',
                            xiaojing: '你好，我是小静。很高兴能与你进行这次对话。📚',
                            xiaomeng: '哥哥～人家是小萌哒！好想和哥哥说话呢～🎀',
                            xiaoku: '我是小酷...有什么事吗？😎'
                        };
                        this.addMessage('bot', greetings[this.currentGirlfriend] || greetings.xiaoya);
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
                        console.log('收到TTS音频数据, messageType:', message.messageType);
                        // TTS音频数据，直接播放
                        if (message.payload && message.payload.length > 0) {
                            this.playAudio(message.payload.buffer || message.payload);
                        } else {
                            console.log('TTS音频数据为空');
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
                        
                    case 551: // CHAT_FINISHED 或其他聊天相关事件
                        console.log('聊天完成事件:', message.payload);
                        if (message.payload?.content) {
                            this.addMessage('bot', message.payload.content);
                        }
                        break;
                        
                    case 250: // 可能的对话回复事件
                    case 251:
                    case 252:
                        console.log('对话事件:', message.eventId, message.payload);
                        if (message.payload?.content || message.payload?.text) {
                            this.addMessage('bot', message.payload.content || message.payload.text);
                        }
                        break;
                        
                    default:
                        // 记录所有未处理的事件，帮助调试
                        console.log('未处理的事件:', message.eventId, message.payload);
                        
                        // 如果payload包含文本内容，尝试显示
                        if (message.payload && typeof message.payload === 'object') {
                            if (message.payload.content) {
                                console.log('发现未知事件中的content:', message.payload.content);
                                this.addMessage('bot', message.payload.content);
                            } else if (message.payload.text) {
                                console.log('发现未知事件中的text:', message.payload.text);
                                this.addMessage('bot', message.payload.text);
                            }
                        }
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
        return Promise.resolve(); // 返回Promise以支持then调用
    }
    
    async startSession() {
        console.log('开始会话');
        this.sessionId = this.generateUUID();
        
        const currentGf = AI_GIRLFRIENDS[this.currentGirlfriend];
        const customPrompt = document.getElementById('promptEditor')?.value.trim();
        
        // 如果有自定义提示词，使用自定义的，否则使用预设
        let systemRole, speakingStyle;
        if (customPrompt && customPrompt !== `${currentGf.systemRole}\n\n${currentGf.speakingStyle}`) {
            // 自定义提示词，尝试分离系统角色和说话风格
            const parts = customPrompt.split('\n\n');
            systemRole = parts[0] || currentGf.systemRole;
            speakingStyle = parts[1] || currentGf.speakingStyle;
        } else {
            systemRole = currentGf.systemRole;
            speakingStyle = currentGf.speakingStyle;
        }
        
        const sessionData = {
            tts: {
                audio_config: {
                    channel: 1,
                    format: "pcm",
                    sample_rate: 24000
                }
            },
            dialog: {
                bot_name: "小雅", // 统一使用小雅，通过system_role区分性格
                system_role: systemRole,
                speaking_style: speakingStyle,
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
            if (!this.audioContext || !audioBuffer) {
                console.log('播放音频失败：audioContext或audioBuffer为空');
                return;
            }
            
            // 确保audioBuffer是ArrayBuffer类型
            let buffer = audioBuffer;
            if (audioBuffer.buffer) {
                buffer = audioBuffer.buffer;
            }
            
            console.log('尝试播放音频，长度:', buffer.byteLength);
            
            if (buffer.byteLength < 8) {
                console.log('音频数据太短，跳过播放');
                return;
            }
            
            // 尝试直接解码（如果是标准音频格式）
            try {
                const audioData = await this.audioContext.decodeAudioData(buffer.slice());
                const source = this.audioContext.createBufferSource();
                source.buffer = audioData;
                source.connect(this.audioContext.destination);
                source.start();
                console.log('标准音频格式播放成功');
                return;
            } catch (e) {
                console.log('标准格式解码失败，尝试PCM:', e.message);
            }
            
            // 尝试作为PCM数据处理 (24kHz, Float32)
            const view = new DataView(buffer);
            const sampleCount = buffer.byteLength / 4;
            
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
            console.error('播放音频失败:', error.message);
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
        this.audioBuffer = [];
        this.bufferSize = 0;
        this.targetBufferSize = 8000; // 500ms at 16kHz - 大幅减少发送频率
        this.lastSendTime = 0;
        this.minSendInterval = 300; // 最小发送间隔300ms
        
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
            
            // 检测音频活动度
            const audioLevel = this.getAudioLevel(inputData);
            
            // 只有在有足够音频活动时才处理
            if (audioLevel > 0.01) {
                const pcmData = this.convertToPCM16(inputData);
                this.audioBuffer.push(pcmData);
                this.bufferSize += pcmData.length;
            }
            
            // 检查是否应该发送（时间和大小条件）
            const now = Date.now();
            const shouldSend = (
                this.bufferSize >= this.targetBufferSize || 
                (this.bufferSize > 1600 && now - this.lastSendTime > this.minSendInterval)
            );
            
            if (shouldSend && now - this.lastSendTime > this.minSendInterval) {
                this.flushAudioBuffer();
                this.lastSendTime = now;
            }
        };
        
        this.setupVolumeIndicator();
    }
    
    getAudioLevel(samples) {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += Math.abs(samples[i]);
        }
        return sum / samples.length;
    }
    
    flushAudioBuffer() {
        if (this.audioBuffer.length === 0) return;
        
        // 合并所有缓冲的音频数据
        const totalSize = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
        const combinedBuffer = new Uint8Array(totalSize);
        let offset = 0;
        
        for (const buffer of this.audioBuffer) {
            combinedBuffer.set(buffer, offset);
            offset += buffer.length;
        }
        
        // 发送合并后的音频数据
        this.sendAudio(combinedBuffer.buffer);
        
        // 清空缓冲区
        this.audioBuffer = [];
        this.bufferSize = 0;
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
    
    handleSessionError() {
        console.log('处理会话错误，重新开始会话');
        this.updateStatus('重新连接中...');
        
        // 停止当前录音
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        // 重新生成会话ID和连接ID
        this.sessionId = this.generateUUID();
        this.connectId = this.generateUUID();
        
        // 如果WebSocket连接有问题，重新连接
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket连接异常，重新连接');
            this.isConnected = false;
            this.connect();
            return;
        }
        
        // 延迟一下再重新开始会话
        setTimeout(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                // 先发送StartConnection再开始会话
                this.sendStartConnection().then(() => {
                    setTimeout(() => {
                        this.startSession();
                    }, 500);
                });
            } else {
                console.log('连接状态异常，重新连接');
                this.connect();
            }
        }, 1000);
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

// 新增的全局函数
function toggleLeftPanel() {
    const panel = document.getElementById('leftPanel');
    panel.classList.toggle('collapsed');
}

function savePrompt() {
    const editor = document.getElementById('promptEditor');
    const currentGf = AI_GIRLFRIENDS[client.currentGirlfriend];
    
    if (editor && editor.value.trim()) {
        // 可以在这里添加保存到localStorage的逻辑
        console.log('保存自定义提示词:', editor.value);
        
        // 显示保存成功提示
        const btn = document.querySelector('.save-btn');
        const originalText = btn.textContent;
        btn.textContent = '已保存！';
        btn.style.background = 'linear-gradient(135deg, #ff6b9d, #ffc3a0)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = 'linear-gradient(135deg, #00ff88, #00cc6a)';
        }, 2000);
        
        // 如果正在通话，提示用户重新开始
        if (client.isInCall) {
            client.addMessage('system', '已保存设置，请重新开始通话以应用新的提示词');
        }
    }
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