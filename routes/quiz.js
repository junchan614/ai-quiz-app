const express = require('express');
const { getDatabase } = require('../database/db');
const authenticateToken = require('../middleware/auth');
const { generateQuizWithRetry } = require('../services/openai');

const router = express.Router();

// クイズ一覧取得
router.get('/', async (req, res) => {
  try {
    const { topic, difficulty, limit = 10, offset = 0 } = req.query;
    const db = getDatabase();
    
    let query = 'SELECT * FROM quizzes WHERE 1=1';
    let params = [];
    
    // フィルター条件の追加
    if (topic) {
      query += ' AND topic = ?';
      params.push(topic);
    }
    
    if (difficulty) {
      query += ' AND difficulty = ?';
      params.push(parseInt(difficulty));
    }
    
    // ソートと件数制限
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const quizzes = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      quizzes: quizzes,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    console.error('クイズ一覧取得エラー:', error);
    res.status(500).json({
      error: 'クイズ一覧の取得に失敗しました'
    });
  }
});

// 特定のクイズ取得
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const quiz = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM quizzes WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!quiz) {
      return res.status(404).json({
        error: 'クイズが見つかりません'
      });
    }
    
    res.json({ quiz });
    
  } catch (error) {
    console.error('クイズ取得エラー:', error);
    res.status(500).json({
      error: 'クイズの取得に失敗しました'
    });
  }
});

// クイズに回答（認証必要）
router.post('/:id/answer', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedAnswer } = req.body;
    const userId = req.user.userId;
    
    // 入力値検証
    if (!selectedAnswer || !['A', 'B', 'C', 'D'].includes(selectedAnswer)) {
      return res.status(400).json({
        error: '正しい回答を選択してください（A, B, C, D）'
      });
    }
    
    const db = getDatabase();
    
    // クイズの存在確認と正解取得
    const quiz = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM quizzes WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!quiz) {
      return res.status(404).json({
        error: 'クイズが見つかりません'
      });
    }
    
    // 正解判定
    const isCorrect = selectedAnswer === quiz.correct_answer;
    
    // 回答履歴の保存
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_answers (user_id, quiz_id, selected_answer, is_correct) VALUES (?, ?, ?, ?)',
        [userId, id, selectedAnswer, isCorrect],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
    
    res.json({
      correct: isCorrect,
      correctAnswer: quiz.correct_answer,
      explanation: quiz.explanation || `正解は${quiz.correct_answer}です。`,
      quiz: {
        id: quiz.id,
        question: quiz.question,
        topic: quiz.topic
      }
    });
    
  } catch (error) {
    console.error('クイズ回答エラー:', error);
    res.status(500).json({
      error: 'クイズの回答に失敗しました'
    });
  }
});

// トピック一覧取得
router.get('/topics/list', async (req, res) => {
  try {
    const db = getDatabase();
    
    const topics = await new Promise((resolve, reject) => {
      db.all(
        'SELECT topic, COUNT(*) as count FROM quizzes GROUP BY topic ORDER BY topic',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    res.json({ topics });
    
  } catch (error) {
    console.error('トピック一覧取得エラー:', error);
    res.status(500).json({
      error: 'トピック一覧の取得に失敗しました'
    });
  }
});

// ランダムクイズ取得
router.get('/random/get', async (req, res) => {
  try {
    const { topic, difficulty } = req.query;
    const db = getDatabase();
    
    let query = 'SELECT * FROM quizzes WHERE 1=1';
    let params = [];
    
    if (topic) {
      query += ' AND topic = ?';
      params.push(topic);
    }
    
    if (difficulty) {
      query += ' AND difficulty = ?';
      params.push(parseInt(difficulty));
    }
    
    query += ' ORDER BY RANDOM() LIMIT 1';
    
    const quiz = await new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!quiz) {
      return res.status(404).json({
        error: '指定条件のクイズが見つかりません'
      });
    }
    
    res.json({ quiz });
    
  } catch (error) {
    console.error('ランダムクイズ取得エラー:', error);
    res.status(500).json({
      error: 'ランダムクイズの取得に失敗しました'
    });
  }
});

// AIでクイズ生成（認証必要）
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, difficulty = 1 } = req.body;
    
    // 入力値検証
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        error: 'トピックは必須項目です'
      });
    }
    
    if (difficulty < 1 || difficulty > 5) {
      return res.status(400).json({
        error: '難易度は1から5の間で設定してください'
      });
    }
    
    // トピックの長さ制限（コスト管理）
    if (topic.length > 100) {
      return res.status(400).json({
        error: 'トピックは100文字以内で入力してください'
      });
    }
    
    console.log(`🎯 AIクイズ生成リクエスト: ${topic} (難易度: ${difficulty}) by ${req.user.username}`);
    
    // OpenAI APIでクイズ生成
    const generatedQuiz = await generateQuizWithRetry(topic.trim(), difficulty);
    
    const db = getDatabase();
    
    // 生成されたクイズをデータベースに保存
    const result = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO quizzes (topic, question, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        generatedQuiz.topic,
        generatedQuiz.question,
        generatedQuiz.option_a,
        generatedQuiz.option_b,
        generatedQuiz.option_c,
        generatedQuiz.option_d,
        generatedQuiz.correct_answer,
        generatedQuiz.difficulty,
        generatedQuiz.explanation
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
    
    // 生成されたクイズにIDを追加
    const finalQuiz = {
      id: result.id,
      ...generatedQuiz
    };
    
    console.log(`✅ AIクイズ生成完了: ID ${result.id}`);
    
    res.status(201).json({
      message: 'AIクイズが正常に生成されました',
      quiz: finalQuiz
    });
    
  } catch (error) {
    console.error('AIクイズ生成エラー:', error);
    
    // OpenAI API特有のエラーかチェック
    if (error.message.includes('OpenAI')) {
      res.status(503).json({
        error: 'AI サービスが一時的に利用できません。しばらく待ってから再試行してください。',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'クイズの生成に失敗しました'
      });
    }
  }
});

// AIで複数クイズ生成（認証必要）
router.post('/generate-batch', authenticateToken, async (req, res) => {
  try {
    const { topic, difficulty = 1, count = 3 } = req.body;
    
    // 入力値検証
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        error: 'トピックは必須項目です'
      });
    }
    
    if (count < 1 || count > 10) {
      return res.status(400).json({
        error: '生成数は1から10の間で設定してください'
      });
    }
    
    console.log(`🎯 AI複数クイズ生成リクエスト: ${topic} ${count}問 by ${req.user.username}`);
    
    const db = getDatabase();
    const savedQuizzes = [];
    const errors = [];
    
    // 指定された数だけクイズを生成
    for (let i = 0; i < count; i++) {
      try {
        console.log(`🤖 ${i + 1}/${count}問目を生成中...`);
        
        // AIでクイズ生成
        const generatedQuiz = await generateQuizWithRetry(topic.trim(), difficulty);
        
        // データベースに保存
        const result = await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO quizzes (topic, question, option_a, option_b, option_c, option_d, correct_answer, difficulty, explanation) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            generatedQuiz.topic,
            generatedQuiz.question,
            generatedQuiz.option_a,
            generatedQuiz.option_b,
            generatedQuiz.option_c,
            generatedQuiz.option_d,
            generatedQuiz.correct_answer,
            generatedQuiz.difficulty,
            generatedQuiz.explanation
          ], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          });
        });
        
        savedQuizzes.push({
          id: result.id,
          ...generatedQuiz
        });
        
        console.log(`✅ ${i + 1}/${count}問目完了: ID ${result.id}`);
        
        // APIレート制限を避けるため少し待機
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.error(`❌ ${i + 1}問目の生成に失敗:`, error.message);
        errors.push({
          index: i + 1,
          error: error.message
        });
      }
    }
    
    res.status(201).json({
      message: `${savedQuizzes.length}問のAIクイズを生成しました`,
      quizzes: savedQuizzes,
      errors: errors,
      summary: {
        requested: count,
        generated: savedQuizzes.length,
        failed: errors.length
      }
    });
    
  } catch (error) {
    console.error('AI複数クイズ生成エラー:', error);
    res.status(500).json({
      error: '複数クイズの生成に失敗しました'
    });
  }
});

module.exports = router;