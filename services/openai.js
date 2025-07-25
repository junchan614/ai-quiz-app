const OpenAI = require('openai');

// OpenAI APIクライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// APIキーの存在確認
if (!process.env.OPENAI_API_KEY) {
  console.error('⚠️  OPENAI_API_KEY環境変数が設定されていません');
  process.exit(1);
}

/**
 * クイズプロンプトの生成
 */
function createQuizPrompt(topic, difficulty = 1) {
  return `
あなたは教育的なクイズを作る専門家です。

以下の仕様で1問のクイズを作成してください：
- トピック: ${topic}
- 難易度: ${difficulty}/5 (1=初級, 2=初中級, 3=中級, 4=中上級, 5=上級)
- 形式: 4択選択問題
- 要件: 正確で教育的、適切な難易度、日本語

必ず以下のJSON形式のみで回答してください（説明文は不要）：
{
  "question": "問題文",
  "option_a": "選択肢A",
  "option_b": "選択肢B", 
  "option_c": "選択肢C",
  "option_d": "選択肢D",
  "correct_answer": "A",
  "explanation": "正解の理由を詳しく説明し、なぜ他の選択肢が間違いなのかも含めた教育的な解説文（100-200文字程度）"
}
`;
}

/**
 * OpenAI APIを使用してクイズを生成
 */
async function generateQuiz(topic, difficulty = 1) {
  try {
    console.log(`🤖 OpenAI APIでクイズ生成開始: ${topic} (難易度: ${difficulty})`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "あなたはクイズ作成の専門家です。正確で教育的な問題を作成し、JSON形式でのみ回答してください。"
        },
        {
          role: "user",
          content: createQuizPrompt(topic, difficulty)
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
      top_p: 1.0
    });

    const responseContent = completion.choices[0].message.content.trim();
    console.log('🎯 OpenAI APIレスポンス受信成功');
    
    // JSONの解析を試行
    let quizData;
    try {
      // レスポンスからJSON部分を抽出（```json や ``` で囲まれている場合があるため）
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseContent;
      
      quizData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError);
      console.error('受信内容:', responseContent);
      throw new Error('AIからの回答をJSON形式で解析できませんでした');
    }

    // 必須フィールドの存在確認
    const requiredFields = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];
    for (const field of requiredFields) {
      if (!quizData[field]) {
        throw new Error(`必須フィールド「${field}」が不足しています`);
      }
    }

    // 正解の妥当性チェック
    if (!['A', 'B', 'C', 'D'].includes(quizData.correct_answer)) {
      throw new Error('正解は A, B, C, D のいずれかである必要があります');
    }

    // トークン使用量のログ
    if (completion.usage) {
      console.log(`📊 トークン使用量: ${completion.usage.total_tokens} (入力: ${completion.usage.prompt_tokens}, 出力: ${completion.usage.completion_tokens})`);
    }

    // 追加のメタデータを設定
    quizData.topic = topic;
    quizData.difficulty = difficulty;
    quizData.generated_at = new Date().toISOString();

    return quizData;

  } catch (error) {
    console.error('❌ OpenAI APIエラー:', error);
    
    // エラータイプに応じた処理
    if (error.status === 401) {
      throw new Error('OpenAI APIキーが無効です。設定を確認してください。');
    } else if (error.status === 429) {
      throw new Error('OpenAI APIの利用制限に達しました。しばらく待ってから再試行してください。');
    } else if (error.status === 500) {
      throw new Error('OpenAIサーバーでエラーが発生しました。しばらく待ってから再試行してください。');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('ネットワーク接続エラーです。インターネット接続を確認してください。');
    }
    
    throw error;
  }
}

/**
 * リトライ機能付きクイズ生成
 */
async function generateQuizWithRetry(topic, difficulty = 1, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateQuiz(topic, difficulty);
    } catch (error) {
      lastError = error;
      console.error(`❌ クイズ生成失敗 (試行 ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        // 指数バックオフ（待機時間を徐々に増加）
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏱️  ${waitTime}ms 待機してリトライします...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`${maxRetries}回試行しましたが、クイズ生成に失敗しました: ${lastError.message}`);
}

/**
 * 複数のクイズを一度に生成
 */
async function generateMultipleQuizzes(topic, difficulty = 1, count = 5) {
  const quizzes = [];
  const errors = [];

  console.log(`🎯 ${count}問のクイズを生成開始: ${topic}`);

  for (let i = 0; i < count; i++) {
    try {
      const quiz = await generateQuizWithRetry(topic, difficulty);
      quizzes.push(quiz);
      console.log(`✅ クイズ ${i + 1}/${count} 生成完了`);
      
      // APIレート制限を避けるため少し待機
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      errors.push({ index: i + 1, error: error.message });
      console.error(`❌ クイズ ${i + 1}/${count} 生成失敗:`, error.message);
    }
  }

  return {
    quizzes,
    errors,
    successCount: quizzes.length,
    totalRequested: count
  };
}

/**
 * APIの接続テスト
 */
async function testOpenAIConnection() {
  try {
    console.log('🔍 OpenAI API接続テスト開始...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "こんにちは。この接続テストメッセージに「接続成功」と返答してください。"
        }
      ],
      max_tokens: 50
    });

    const response = completion.choices[0].message.content;
    console.log('✅ OpenAI API接続テスト成功:', response);
    
    return {
      success: true,
      response: response,
      usage: completion.usage
    };
  } catch (error) {
    console.error('❌ OpenAI API接続テスト失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateQuiz,
  generateQuizWithRetry,
  generateMultipleQuizzes,
  testOpenAIConnection
};