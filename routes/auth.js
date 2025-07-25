const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/db');

const router = express.Router();

// ユーザー登録
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 入力値検証
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'ユーザー名、メールアドレス、パスワードは必須です'
      });
    }
    
    // パスワード強度チェック
    if (password.length < 8) {
      return res.status(400).json({
        error: 'パスワードは8文字以上である必要があります'
      });
    }
    
    const db = getDatabase();
    
    // 既存ユーザーのチェック
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (existingUser) {
      return res.status(409).json({
        error: 'ユーザー名またはメールアドレスが既に使用されています'
      });
    }
    
    // パスワードのハッシュ化
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // ユーザーの作成
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
    
    // JWTトークンの生成
    const token = jwt.sign(
      { 
        userId: result.id, 
        username: username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // HTTPOnlyクッキーでトークンを送信
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24時間
    });
    
    res.status(201).json({
      message: 'ユーザー登録が完了しました',
      user: {
        id: result.id,
        username: username,
        email: email
      }
    });
    
  } catch (error) {
    console.error('ユーザー登録エラー:', error);
    res.status(500).json({
      error: 'ユーザー登録に失敗しました'
    });
  }
});

// ユーザーログイン
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 入力値検証
    if (!username || !password) {
      return res.status(400).json({
        error: 'ユーザー名とパスワードは必須です'
      });
    }
    
    const db = getDatabase();
    
    // ユーザーの検索
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!user) {
      return res.status(401).json({
        error: 'ユーザー名またはパスワードが間違っています'
      });
    }
    
    // パスワードの検証
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'ユーザー名またはパスワードが間違っています'
      });
    }
    
    // JWTトークンの生成
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // HTTPOnlyクッキーでトークンを送信
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24時間
    });
    
    res.json({
      message: 'ログインしました',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('ログインエラー:', error);
    res.status(500).json({
      error: 'ログインに失敗しました'
    });
  }
});

// ログアウト
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'ログアウトしました' });
});

// 認証状態の確認
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        error: '認証が必要です'
      });
    }
    
    // トークンの検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const db = getDatabase();
    
    // ユーザー情報の取得
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [decoded.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!user) {
      return res.status(401).json({
        error: 'ユーザーが見つかりません'
      });
    }
    
    res.json({
      user: user
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '無効なトークンです'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'トークンの有効期限が切れています'
      });
    }
    
    console.error('認証確認エラー:', error);
    res.status(500).json({
      error: '認証確認に失敗しました'
    });
  }
});

module.exports = router;