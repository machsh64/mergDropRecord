const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config();

const { initDatabase, getRecordByDate, upsertRecord, getMonthlyStats, getAllRecords, deleteRecordByDate, getRecordsByCreatedAtRange } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 登录凭证（从环境变量读取）
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session 配置
app.use(session({
  secret: 'airdrop-tracker-secret-key-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 如果使用 HTTPS，设置为 true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 小时
  }
}));

// 身份验证中间件
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({
    success: false,
    message: '未授权，请先登录'
  });
};

// API 路由

// 登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({
      success: true,
      message: '登录成功'
    });
  } else {
    res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }
});

// 登出接口
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({
    success: true,
    message: '已登出'
  });
});

// 检查认证状态
app.get('/api/check-auth', (req, res) => {
  res.json({
    authenticated: req.session && req.session.authenticated === true,
    username: req.session ? req.session.username : null
  });
});

// 所有其他 API 路由都需要身份验证

// 创建或更新交易记录
app.post('/api/records', requireAuth, async (req, res) => {
  try {
    const record = req.body;
    
    // 验证必填字段
    if (!record.date) {
      return res.status(400).json({
        success: false,
        message: '日期不能为空'
      });
    }

    const result = await upsertRecord(record);
    
    res.json({
      success: true,
      data: {
        ...result,
        net_points: result.points_balance + result.points_trading - result.points_consumed
      },
      message: '记录保存成功'
    });
  } catch (error) {
    console.error('保存记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存记录失败',
      error: error.message
    });
  }
});

// 更新交易记录
app.put('/api/records/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const record = req.body;
    
    // 这里可以实现按ID更新的逻辑
    // 目前使用 upsertRecord 来处理
    const result = await upsertRecord(record);
    
    res.json({
      success: true,
      data: {
        ...result,
        net_points: result.points_balance + result.points_trading - result.points_consumed
      },
      message: '记录更新成功'
    });
  } catch (error) {
    console.error('更新记录失败:', error);
    res.status(500).json({
      success: false,
      message: '更新记录失败',
      error: error.message
    });
  }
});

// 获取月度统计数据
app.get('/api/stats/:year/:month', requireAuth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const stats = await getMonthlyStats(parseInt(year), parseInt(month));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取月度统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取月度统计失败',
      error: error.message
    });
  }
});

// 根据 created_at 时间范围获取记录（用于15天统计）
// 接收北京时间的开始和结束时间戳，后端转换为 UTC 时间查询
app.get('/api/records-by-time', requireAuth, async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: '缺少开始时间或结束时间参数'
      });
    }
    
    // 前端传来的是北京时间的时间戳（毫秒），数据库中是 UTC 时间
    // 北京时间 = UTC + 8小时，所以 UTC = 北京时间 - 8小时
    const startTimeUTC = new Date(parseInt(startTime) - 8 * 60 * 60 * 1000).toISOString();
    const endTimeUTC = new Date(parseInt(endTime) - 8 * 60 * 60 * 1000).toISOString();
    
    const records = await getRecordsByCreatedAtRange(startTimeUTC, endTimeUTC);
    
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('根据时间范围获取记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取记录失败',
      error: error.message
    });
  }
});

// 删除指定日期的交易记录（必须在 GET /api/records/:date 之前）
app.delete('/api/records/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = await deleteRecordByDate(date);
    
    if (result) {
      res.json({
        success: true,
        message: '记录删除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
  } catch (error) {
    console.error('删除记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除记录失败',
      error: error.message
    });
  }
});

// 获取所有记录
app.get('/api/records', requireAuth, async (req, res) => {
  try {
    const records = await getAllRecords();
    
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('获取所有记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取所有记录失败',
      error: error.message
    });
  }
});

// 获取指定日期的交易记录（必须在所有更具体的路由之后）
app.get('/api/records/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const record = await getRecordByDate(date);
    
    if (!record) {
      return res.json({
        success: true,
        data: null,
        message: '该日期暂无交易记录'
      });
    }

    res.json({
      success: true,
      data: {
        ...record,
        net_points: record.points_balance + record.points_trading - record.points_consumed
      }
    });
  } catch (error) {
    console.error('获取记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取记录失败',
      error: error.message
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 主页路由（需要登录）
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.redirect('/login.html');
  }
});

// 静态文件服务（其他页面）
app.use(express.static(path.join(__dirname, 'public')));

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? error.message : '未知错误'
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`访问地址: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
