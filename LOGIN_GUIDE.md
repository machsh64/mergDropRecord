# 登录验证功能说明

## 功能概述

已为 Airdrop Tracker 添加了简单的登录验证功能，保护应用数据安全。

## 登录凭证

- **用户名**: `username`
- **密码**: `password`

## 功能特性

### 1. 登录页面
- 美观的渐变背景设计
- 响应式布局，支持移动端
- 错误提示动画效果
- 禁止复制粘贴和双击放大

### 2. 身份验证
- 所有 API 接口都需要登录后才能访问
- Session 会话保持 24 小时
- 未登录自动跳转到登录页

### 3. 安全特性
- Session 管理（基于 express-session）
- API 接口身份验证中间件
- 自动登录状态检查
- 安全的登出功能

## 使用流程

### 1. 安装新依赖

首次部署或更新后需要安装新增的依赖：

```powershell
npm install
```

这会安装 `express-session` 包。

### 2. 启动应用

**本地开发:**
```powershell
npm start
# 或
npm run dev
```

**Docker 部署:**
```powershell
.\deploy.bat
```

### 3. 访问应用

- 打开浏览器访问: `http://localhost:3000` (或 `http://localhost:8080` 如果使用 Docker)
- 自动跳转到登录页面
- 输入用户名和密码
- 登录成功后进入主页面

### 4. 登出

点击右下角的"登出"按钮即可退出登录。

## API 端点

### 公开端点（无需登录）

- `POST /api/login` - 用户登录
- `GET /api/check-auth` - 检查登录状态
- `GET /api/health` - 健康检查

### 受保护端点（需要登录）

- `POST /api/records` - 创建/更新记录
- `PUT /api/records/:id` - 更新记录
- `DELETE /api/records/:date` - 删除记录
- `GET /api/records` - 获取所有记录
- `GET /api/records/:date` - 获取指定日期记录
- `GET /api/stats/:year/:month` - 获取月度统计

## 技术实现

### 服务端 (server.js)

1. **Session 配置**
```javascript
app.use(session({
  secret: 'airdrop-tracker-secret-key-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 小时
  }
}));
```

2. **身份验证中间件**
```javascript
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({
    success: false,
    message: '未授权，请先登录'
  });
};
```

3. **路由保护**
- 所有 `/api/*` 路由（除登录相关）都使用 `requireAuth` 中间件
- 主页路由检查登录状态，未登录重定向到登录页

### 前端

1. **登录页面** (`public/login.html`)
   - 简洁美观的UI设计
   - 表单验证
   - 错误提示

2. **主页面** (`public/index.html`)
   - 添加登出按钮
   - 自动登录检查

3. **应用逻辑** (`public/js/app.js`)
   - 登出功能实现
   - 错误处理（401 自动跳转登录页）

## 自定义配置

### 修改登录凭证

编辑 `server.js` 文件：

```javascript
// 登录凭证
const AUTH_USERNAME = 'your_username';
const AUTH_PASSWORD = 'your_password';
```

### 修改 Session 过期时间

编辑 `server.js` 中的 session 配置：

```javascript
cookie: {
  maxAge: 7 * 24 * 60 * 60 * 1000 // 改为 7 天
}
```

### 启用 HTTPS

如果部署在生产环境使用 HTTPS，修改：

```javascript
cookie: {
  secure: true, // 改为 true
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000
}
```

## 注意事项

1. **生产环境安全**
   - 建议使用更安全的密码
   - 启用 HTTPS
   - 使用固定的 session secret（不要使用随机值）
   - 考虑使用环境变量存储凭证

2. **Session 存储**
   - 当前使用内存存储 session
   - 服务器重启后 session 会丢失
   - 生产环境建议使用 Redis 或数据库存储 session

3. **Docker 部署**
   - Session 在容器重启后会失效
   - 建议配置持久化的 session 存储

## 故障排查

### 无法登录
- 检查用户名和密码是否正确
- 查看浏览器控制台是否有错误
- 检查服务器日志

### Session 丢失
- 检查 cookie 设置
- 确认浏览器允许 cookie
- 检查 session 配置

### API 返回 401
- 说明未登录或 session 过期
- 重新登录即可

## 升级步骤总结

对于已有项目，执行以下步骤升级：

1. 拉取最新代码
2. 安装新依赖: `npm install`
3. 重启服务器: `npm start`
4. 访问应用，使用新的登录页面

对于 Docker 部署:

1. 拉取最新代码
2. 重新构建: `docker-compose build`
3. 启动容器: `docker-compose up -d`
4. 访问应用
