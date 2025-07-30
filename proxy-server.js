const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end('WebSocket代理服务器正在运行');
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({
    server: server,
    path: '/'
});

// 处理WebSocket连接
wss.on('connection', function connection(ws, request) {
    const clientIP = request.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] 客户端连接: ${clientIP}`);
    
    // 从URL参数中获取认证信息
    const query = url.parse(request.url, true).query;
    console.log(`[${new Date().toISOString()}] 接收到参数:`, {
        appId: query.appId ? query.appId.substring(0, 4) + '***' : '无',
        accessKey: query.accessKey ? query.accessKey.substring(0, 8) + '***' : '无',
        connectId: query.connectId || '无'
    });
    
    if (!query.appId || !query.accessKey) {
        console.error(`[${new Date().toISOString()}] ❌ 缺少认证信息`);
        ws.close(4000, 'Missing authentication');
        return;
    }
    
    console.log(`[${new Date().toISOString()}] 🔄 正在连接豆包API...`);
    
    // 连接到豆包API
    const douBaoWs = new WebSocket('wss://openspeech.bytedance.com/api/v3/realtime/dialogue', {
        headers: {
            'X-Api-App-ID': query.appId,
            'X-Api-Access-Key': query.accessKey,
            'X-Api-Resource-Id': 'volc.speech.dialog',
            'X-Api-App-Key': 'PlgvMymc7f3tQnJ6',
            'X-Api-Connect-Id': query.connectId || 'default-connect-id',
            'User-Agent': 'RealTimeDialogProxy/1.0'
        },
        timeout: 10000
    });
    
    // 转发消息：客户端 -> 豆包API
    ws.on('message', function message(data) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] 📤 收到客户端消息，长度: ${data.length} bytes`);
        
        // 显示消息的hex内容（前32字节）
        const preview = Array.from(data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[${timestamp}] 数据预览: ${preview}${data.length > 32 ? '...' : ''}`);
        
        if (douBaoWs.readyState === WebSocket.OPEN) {
            douBaoWs.send(data);
            console.log(`[${timestamp}] ✅ 已转发到豆包API`);
        } else {
            console.log(`[${timestamp}] ⚠️ 豆包API连接未就绪，状态: ${douBaoWs.readyState}`);
        }
    });
    
    // 转发消息：豆包API -> 客户端
    douBaoWs.on('message', function message(data) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] 📥 收到豆包API消息，长度: ${data.length} bytes`);
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
            console.log(`[${timestamp}] ✅ 已转发到客户端`);
        } else {
            console.log(`[${timestamp}] ⚠️ 客户端连接已断开`);
        }
    });
    
    // 处理连接事件
    douBaoWs.on('open', function open() {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ✅ 豆包API连接成功！`);
        
        // 获取响应头信息
        if (douBaoWs.response && douBaoWs.response.headers) {
            const logId = douBaoWs.response.headers['x-tt-logid'];
            if (logId) {
                console.log(`[${timestamp}] 📋 LogID: ${logId}`);
            }
        }
    });
    
    douBaoWs.on('error', function error(err) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ❌ 豆包API连接错误:`, {
            message: err.message,
            code: err.code,
            type: err.type
        });
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(4001, 'DouyinAPI connection failed');
        }
    });
    
    douBaoWs.on('close', function close(code, reason) {
        const timestamp = new Date().toISOString();
        const reasonStr = reason ? reason.toString() : '无';
        console.log(`[${timestamp}] 🔌 豆包API连接关闭 - Code: ${code}, Reason: ${reasonStr}`);
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(code, reason);
        }
    });
    
    // 处理客户端断开
    ws.on('close', function close(code, reason) {
        const timestamp = new Date().toISOString();
        const reasonStr = reason ? reason.toString() : '无';
        console.log(`[${timestamp}] 👋 客户端断开 - Code: ${code}, Reason: ${reasonStr}`);
        
        if (douBaoWs.readyState === WebSocket.OPEN) {
            douBaoWs.close();
        }
    });
    
    ws.on('error', function error(err) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ❌ 客户端连接错误:`, err.message);
        
        if (douBaoWs.readyState === WebSocket.OPEN) {
            douBaoWs.close();
        }
    });
});

// 启动服务器
const PORT = 8080;
server.listen(PORT, function listening() {
    console.log(`WebSocket代理服务器运行在 http://localhost:${PORT}`);
    console.log('请在浏览器中打开 index.html 文件');
});