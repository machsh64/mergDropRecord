const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'airdrop_tracker',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// 初始化数据库表
async function initDatabase() {
  try {
    const client = await pool.connect();
    
    // 创建交易记录表
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        volume DECIMAL(15,8) DEFAULT 0,
        points_balance INTEGER DEFAULT 2,
        points_trading INTEGER DEFAULT 0,
        points_consumed INTEGER DEFAULT 0,
        loss DECIMAL(15,8) DEFAULT 0,
        income DECIMAL(15,8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date)
      )
    `);

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)
    `);

    console.log('数据库表初始化完成');
    client.release();
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

// 获取指定日期的交易记录
async function getRecordByDate(date) {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE date = $1',
      [date]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('获取交易记录失败:', error);
    throw error;
  }
}

// 创建或更新交易记录
async function upsertRecord(record) {
  try {
    const {
      date,
      volume = 0,
      points_balance = 2,
      points_trading = 0,
      points_consumed = 0,
      loss = 0,
      income = 0
    } = record;

    const result = await pool.query(`
      INSERT INTO transactions (date, volume, points_balance, points_trading, points_consumed, loss, income)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (date)
      DO UPDATE SET
        volume = EXCLUDED.volume,
        points_balance = EXCLUDED.points_balance,
        points_trading = EXCLUDED.points_trading,
        points_consumed = EXCLUDED.points_consumed,
        loss = EXCLUDED.loss,
        income = EXCLUDED.income,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [date, volume, points_balance, points_trading, points_consumed, loss, income]);

    return result.rows[0];
  } catch (error) {
    console.error('保存交易记录失败:', error);
    throw error;
  }
}

// 获取月度统计数据
async function getMonthlyStats(year, month) {
  try {
    const result = await pool.query(`
      SELECT 
        date,
        volume,
        points_balance,
        points_trading,
        points_consumed,
        loss,
        income,
        (points_balance + points_trading - points_consumed) as net_points
      FROM transactions 
      WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
      ORDER BY date
    `, [year, month]);

    return result.rows;
  } catch (error) {
    console.error('获取月度统计失败:', error);
    throw error;
  }
}

// 获取所有交易记录
async function getAllRecords() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        date,
        volume,
        points_balance,
        points_trading,
        points_consumed,
        loss,
        income,
        (points_balance + points_trading - points_consumed) as net_points,
        created_at,
        updated_at
      FROM transactions 
      ORDER BY date DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('获取所有记录失败:', error);
    throw error;
  }
}

// 删除指定日期的交易记录
async function deleteRecordByDate(date) {
  try {
    const result = await pool.query(
      'DELETE FROM transactions WHERE date = $1 RETURNING *',
      [date]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('删除交易记录失败:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initDatabase,
  getRecordByDate,
  upsertRecord,
  getMonthlyStats,
  getAllRecords,
  deleteRecordByDate
};
