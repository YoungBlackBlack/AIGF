# 部署说明

## 重要提醒

⚠️ **Vercel限制说明**: Vercel的Serverless Functions不支持持久的WebSocket连接，因此当前的WebSocket代理服务器无法直接在Vercel上运行。

## 推荐的部署方案

### 1. Render.com （推荐）
- ✅ 免费套餐支持WebSocket
- ✅ 自动从GitHub部署
- ✅ 支持环境变量

**部署步骤:**
1. 推送代码到GitHub
2. 在Render创建Web Service
3. 连接GitHub仓库
4. 设置构建命令: `npm install`
5. 设置启动命令: `node proxy-server.js`
6. 配置环境变量:
   - `DOUBAO_APP_ID`: 你的豆包应用ID
   - `DOUBAO_ACCESS_KEY`: 你的豆包访问密钥

### 2. Railway.app
- ✅ 支持WebSocket
- ✅ GitHub集成
- ✅ 免费额度

### 3. Heroku
- ✅ 支持WebSocket
- ✅ 免费套餐（需要信用卡验证）

### 4. DigitalOcean App Platform
- ✅ 支持WebSocket
- 💰 付费服务，但性能稳定

## 本地开发

1. 克隆项目：
```bash
git clone <your-repo-url>
cd realtime_dialog
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量（可选，也可在页面中配置）：
```bash
export DOUBAO_APP_ID="your-app-id"
export DOUBAO_ACCESS_KEY="your-access-key"
```

4. 启动服务器：
```bash
npm start
```

5. 在浏览器打开 `http://localhost:8080` 查看页面

## 配置API密钥

### 方法1: 环境变量（推荐）
在部署平台中配置：
- `DOUBAO_APP_ID`: 你的豆包应用ID
- `DOUBAO_ACCESS_KEY`: 你的豆包访问密钥

### 方法2: 页面配置
点击页面右上角的设置按钮，输入API密钥

### 方法3: 代码配置（仅用于测试，不推荐）
直接在`realtime-client-simple.js`中修改配置

## 获取DouBao API密钥

1. 访问[火山控制台](https://console.volcengine.com/)
2. 进入端到端大模型服务
3. 创建应用并获取App ID和Access Key

## 故障排除

### WebSocket连接失败
- 检查API密钥是否正确
- 确认服务器支持WebSocket
- 查看浏览器控制台错误信息

### 音频无法播放
- 确保浏览器支持Web Audio API
- 检查麦克风权限
- 尝试HTTPS环境（某些功能需要安全上下文）

### 代理服务器无响应
- 确认Node.js版本 >= 14
- 检查端口8080是否被占用
- 查看服务器日志输出