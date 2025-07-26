const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// データベース初期化
const { initializeDatabase } = require('./database/db');

// ルーターのインポート
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// データベース初期化（非同期）
initializeDatabase().catch(error => {
  console.error('データベース初期化に失敗しました:', error);
  process.exit(1);
});

// セキュリティミドルウェア（CSPを一時的に無効化）
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS設定（本番環境対応）
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
  optionsSuccessStatus: 200
}));

// レート制限（本番環境強化）
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000), // 15分
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 100 : 1000),
  message: {
    error: 'リクエストが多すぎます。しばらく待ってから再試行してください。'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ログイン試行のレート制限（開発環境では緩和）
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // 開発環境では50回
  message: {
    error: 'ログイン試行回数が上限に達しました。しばらく待ってから再試行してください。'
  }
});

app.use(limiter);

// セキュリティヘッダーの追加
app.use((req, res, next) => {
  // XSS攻撃対策
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // 本番環境のみHTTPS強制
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// 基本ミドルウェア
app.use(express.json({ limit: '1mb' })); // 本番環境では制限を厳しく
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser({
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax'
}));

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// API ルート
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/user', userRoutes);

// ルートページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA用のキャッチオール（HTML5 History API対応）
app.get('*', (req, res) => {
  // APIリクエストでない場合はindex.htmlを返す
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// エラーハンドラー
app.use((error, req, res, next) => {
  console.error('サーバーエラー:', error);
  
  // 本番環境では詳細なエラー情報を隠す
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal server error'
    });
  } else {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found'
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`📝 環境: ${process.env.NODE_ENV || 'development'}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('サーバーを停止しています...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('サーバーを停止しています...');
  process.exit(0);
});

module.exports = app;