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
あなたは優秀な教育者であり、学習者の理解を深める専門家です。

以下の仕様で教育的なクイズを作成してください：
- トピック: ${topic}
- 難易度: ${difficulty}/5 (1=初級, 2=初中級, 3=中級, 4=中上級, 5=上級)
- 形式: 4択選択問題
- 要件: 正確で教育的、適切な難易度、日本語

解説では以下を必ず含めてください：
1. 正解の理由と根拠（背景知識や原理を含む）
2. なぜ他の選択肢が間違いなのかの具体的説明
3. 覚えておくべきポイントや関連知識
4. 実際の応用例や補足情報（可能な場合）

必ず以下のJSON形式のみで回答してください：
{
  "question": "問題文",
  "option_a": "選択肢A",
  "option_b": "選択肢B", 
  "option_c": "選択肢C",
  "option_d": "選択肢D",
  "correct_answer": "A",
  "explanation": "正解の理由と根拠を詳しく説明し、他の選択肢が間違いである理由も含む教育的で詳細な解説（200-300文字程度）。学習者の理解を深める内容にしてください。"
}
`;
}

/**
 * 難易度に応じてOpenAIモデルを選択
 */
function selectModel(difficulty) {
  // 難易度3以上の場合はGPT-4oを使用、それ以外はGPT-3.5-turbo
  return difficulty >= 3 ? "gpt-4o" : "gpt-3.5-turbo";
}

/**
 * OpenAI APIを使用してクイズを生成
 */
async function generateQuiz(topic, difficulty = 1) {
  try {
    const selectedModel = selectModel(difficulty);
    console.log(`🤖 OpenAI APIでクイズ生成開始: ${topic} (難易度: ${difficulty}) [モデル: ${selectedModel}]`);
    
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: selectedModel === "gpt-4o" 
            ? "あなたは最高レベルの教育者であり、高難易度の問題において完璧な正確性が求められます。数学的事実、科学的原理、論理的推論において一切の誤りを避け、最も正確で教育的な解説を提供してください。特に基本的な定理や公式については絶対に間違えないでください。学習者が「なるほど！」と納得できる高品質な解説を心がけ、JSON形式でのみ回答してください。"
            : "あなたは優秀な教育者であり、学習者の理解を深めることが得意な専門家です。クイズの解説では、単に正解を示すだけでなく、その理由や背景知識、他の選択肢が間違いである根拠を詳しく説明してください。学習者が「なるほど！」と納得できる教育的な解説を心がけ、JSON形式でのみ回答してください。"
        },
        {
          role: "user",
          content: createQuizPrompt(topic, difficulty)
        }
      ],
      max_tokens: selectedModel === "gpt-4o" ? 800 : 650,
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

    // デバッグ: 生成された解説の内容を詳しく確認
    console.log(`📝 生成された解説 [${selectedModel}]:`, quizData.explanation);
    console.log('📏 解説の長さ:', quizData.explanation ? quizData.explanation.length : 0, '文字');

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