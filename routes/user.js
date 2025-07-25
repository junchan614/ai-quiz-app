const express = require('express');
const { getDatabase } = require('../database/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// ユーザーの統計情報取得（認証必要）
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDatabase();
    
    // ユーザーの統計をビューから取得
    const stats = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM user_stats WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    // 統計が存在しない場合（まだクイズに回答していない）
    if (!stats) {
      return res.json({
        stats: {
          user_id: userId,
          username: req.user.username,
          total_answers: 0,
          correct_answers: 0,
          accuracy_percentage: 0,
          first_quiz_date: null,
          last_quiz_date: null
        }
      });
    }
    
    res.json({ stats });
    
  } catch (error) {
    console.error('ユーザー統計取得エラー:', error);
    res.status(500).json({
      error: 'ユーザー統計の取得に失敗しました'
    });
  }
});

// ユーザーの回答履歴取得（認証必要）
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;
    const db = getDatabase();
    
    // 回答履歴の取得（クイズ情報も含む）
    const history = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          ua.id,
          ua.selected_answer,
          ua.is_correct,
          ua.answered_at,
          q.id as quiz_id,
          q.topic,
          q.question,
          q.correct_answer,
          q.difficulty
        FROM user_answers ua
        JOIN quizzes q ON ua.quiz_id = q.id
        WHERE ua.user_id = ?
        ORDER BY ua.answered_at DESC
        LIMIT ? OFFSET ?
      `, [userId, parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // 総件数の取得
    const totalCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM user_answers WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    res.json({
      history,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalCount
      }
    });
    
  } catch (error) {
    console.error('回答履歴取得エラー:', error);
    res.status(500).json({
      error: '回答履歴の取得に失敗しました'
    });
  }
});

// トピック別統計取得（認証必要）
router.get('/topic-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDatabase();
    
    // ユーザーのトピック別統計を取得
    const topicStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          q.topic,
          COUNT(ua.id) as total_attempts,
          SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
          ROUND(
            (SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0) / COUNT(ua.id), 
            2
          ) as accuracy_percentage,
          MIN(ua.answered_at) as first_attempt,
          MAX(ua.answered_at) as last_attempt
        FROM user_answers ua
        JOIN quizzes q ON ua.quiz_id = q.id
        WHERE ua.user_id = ?
        GROUP BY q.topic
        ORDER BY total_attempts DESC
      `, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({ topicStats });
    
  } catch (error) {
    console.error('トピック別統計取得エラー:', error);
    res.status(500).json({
      error: 'トピック別統計の取得に失敗しました'
    });
  }
});

// ユーザープロフィール更新（認証必要）
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;
    
    // 入力値検証
    if (!email) {
      return res.status(400).json({
        error: 'メールアドレスは必須です'
      });
    }
    
    // 簡単なメール形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: '正しいメールアドレス形式を入力してください'
      });
    }
    
    const db = getDatabase();
    
    // 他のユーザーが同じメールアドレスを使用していないかチェック
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (existingUser) {
      return res.status(409).json({
        error: 'このメールアドレスは既に使用されています'
      });
    }
    
    // プロフィール更新
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [email, userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // 更新後のユーザー情報を取得
    const updatedUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email, updated_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    res.json({
      message: 'プロフィールが更新されました',
      user: updatedUser
    });
    
  } catch (error) {
    console.error('プロフィール更新エラー:', error);
    res.status(500).json({
      error: 'プロフィールの更新に失敗しました'
    });
  }
});

module.exports = router;