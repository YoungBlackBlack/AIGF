# 虚拟女友实时语音对话

基于DouBao（豆包）API的实时语音对话web应用，提供类似手机通话的用户界面。

## 功能特性

- 🎤 实时语音对话
- 📱 iPhone风格通话界面
- 💬 实时文字转录
- 🎵 音频可视化
- 🌐 Web端免安装使用

## 快速开始

### 环境要求

- Node.js 14+
- 现代浏览器（支持WebSocket和Web Audio API）

### 本地运行

1. 克隆项目：
```bash
git clone <repository-url>
cd realtime_dialog
```

2. 安装依赖：
```bash
npm install
```

3. 配置API密钥：
在index.html中配置你的DouBao API密钥，或通过设置按钮在页面中配置

4. 启动代理服务器：
```bash
node proxy-server.js
```

5. 在浏览器中打开 `index.html`

### Vercel部署

1. 将代码推送到GitHub仓库

2. 在Vercel中导入项目

3. 配置环境变量：
   - `DOUBAO_APP_ID`: 你的豆包应用ID
   - `DOUBAO_ACCESS_KEY`: 你的豆包访问密钥

4. 部署完成！

## 技术架构

- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **后端**: Node.js WebSocket代理服务器
- **API**: DouBao实时语音对话API
- **部署**: Vercel Serverless Functions

## 文件说明

- `index.html` - 主页面，提供iPhone风格的通话界面
- `realtime-client-simple.js` - WebSocket客户端和音频处理
- `proxy-server.js` - Node.js代理服务器（本地开发用）
- `api/websocket.js` - Vercel Serverless WebSocket处理器
- `vercel.json` - Vercel部署配置

## Python版本（已弃用）

此demo最初使用python3.7环境进行开发调试，其他python版本可能会有兼容性问题。

1. 配置API密钥
   - 打开 `config.py` 文件
   - 修改以下两个字段：
     ```python
     "X-Api-App-ID": "火山控制台上端到端大模型对应的App ID",
     "X-Api-Access-Key": "火山控制台上端到端大模型对应的Access Key",
     ```

2. 安装依赖
   ```bash
   pip install -r requirements.txt