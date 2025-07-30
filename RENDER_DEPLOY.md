# Render.com 部署完整指南

## 🚀 快速部署步骤

### 第一步：推送到GitHub

1. **在GitHub创建新仓库**
   ```
   访问：https://github.com/new
   仓库名：virtual-girlfriend-chat
   描述：虚拟女友实时语音对话
   设置：Public（推荐）
   ❌ 不要勾选 "Add a README file"
   ```

2. **推送本地代码**
   ```bash
   # 如果还没设置远程仓库，运行：
   git remote add origin https://github.com/YOUR_USERNAME/virtual-girlfriend-chat.git
   git branch -M main
   git push -u origin main
   ```

### 第二步：Render部署

1. **注册Render账号**
   - 访问：https://render.com
   - 点击 "Get Started" 
   - 建议用GitHub账号登录

2. **创建Web Service**
   - Dashboard → 点击 "New +"
   - 选择 "Web Service"
   - 选择你的GitHub仓库 `virtual-girlfriend-chat`

3. **配置服务设置**
   ```
   Name: virtual-girlfriend-chat
   Region: Oregon (US West) 或就近选择
   Branch: main
   Root Directory: 留空
   Runtime: Node
   Build Command: npm install
   Start Command: node proxy-server.js
   ```

4. **添加环境变量**
   在 "Environment Variables" 部分添加：
   ```
   DOUBAO_APP_ID = 9047255535
   DOUBAO_ACCESS_KEY = 8YrYKqRMJmIYslYKYhBoxki-yhHnYN7U
   ```

5. **选择计划**
   - 免费计划：Free ($0/month) - 适合测试
   - 付费计划：$7/month - 更稳定，无睡眠

6. **部署**
   - 点击 "Create Web Service"
   - 等待构建（约2-3分钟）

### 第三步：访问应用

- 部署完成后，Render会提供URL：
  ```
  https://virtual-girlfriend-chat-xxxx.onrender.com
  ```
- 直接访问该URL即可使用

## 📋 部署检查清单

- [ ] GitHub仓库已创建并推送代码
- [ ] Render账号已注册
- [ ] Web Service已创建并连接到GitHub仓库
- [ ] 构建和启动命令正确设置
- [ ] 环境变量已配置
- [ ] 部署状态显示 "Live"

## 🔧 常见问题解决

### 构建失败
- 检查 `package.json` 是否存在
- 确认Node.js版本兼容（项目设置>=14）

### 服务无法启动
- 确认启动命令：`node proxy-server.js`
- 检查代码中端口配置

### WebSocket连接失败
- 确认环境变量设置正确
- 检查浏览器控制台错误信息
- 确认服务状态为 "Live"

### 免费计划限制
- 30分钟无访问会自动睡眠
- 首次唤醒可能需要10-30秒
- 月流量限制：100GB

## 💡 优化建议

1. **自定义域名**（可选）
   - Render支持自定义域名
   - 需要付费计划

2. **性能监控**
   - Render提供内置监控
   - 查看CPU、内存使用情况

3. **自动部署**
   - 推送到main分支自动触发部署
   - 可在设置中配置部署钩子

## 🎯 测试清单

部署完成后，测试以下功能：
- [ ] 页面正常加载
- [ ] 点击设置按钮可以打开配置
- [ ] 点击通话按钮可以连接
- [ ] 麦克风权限请求正常
- [ ] WebSocket连接成功
- [ ] 音频录制和播放正常

## 📞 获取支持

如果遇到问题：
1. 检查Render Dashboard的Logs
2. 查看浏览器开发者工具Console
3. 参考项目的README.md和DEPLOYMENT.md
4. Render官方文档：https://render.com/docs