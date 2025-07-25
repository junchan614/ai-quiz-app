# OpenAI API連携解説

## OpenAI APIとは？

**OpenAI API**は、ChatGPTなどのAI技術を自分のアプリケーションに組み込むためのサービスです。

### 身近な例で理解
**翻訳サービス**で例えると：
- **従来**: 自分で辞書を作って翻訳プログラムを開発
- **OpenAI API**: Googleの高性能翻訳機能を自分のアプリで利用

## OpenAI APIの基本概念

### 1. APIキー（認証）
```javascript
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // 秘密の認証キー
});
```

**APIキーの重要性**:
- OpenAIがあなたを識別するための秘密のパスワード
- **絶対に公開してはいけない**
- 使用量課金の基準となる

### 2. モデルの種類
```javascript
// GPT-3.5 Turbo（コスト効率重視）
model: "gpt-3.5-turbo"

// GPT-4（高性能・高コスト）
model: "gpt-4"

// GPT-4o（最新・バランス型）
model: "gpt-4o"
```

**このプロジェクトの選択**: `gpt-3.5-turbo`
- 理由：コスト効率が良く、クイズ生成には十分な性能

### 3. プロンプト設計
```javascript
const prompt = `
あなたはクイズ作成の専門家です。
以下の条件でクイズを1問作成してください：

トピック: ${topic}
難易度: ${difficulty}

形式:
- 質問文
- 選択肢A、B、C、D（4択）
- 正解（A、B、C、Dのいずれか）

JSON形式で回答してください。
`;
```

## API使用の流れ

### 1. ライブラリのインポート
```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### 2. リクエストの送信
```javascript
async function generateQuiz(topic, difficulty = 1) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "あなたはクイズ作成の専門家です。"
        },
        {
          role: "user", 
          content: `${topic}に関する難易度${difficulty}のクイズを作成してください。`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API エラー:', error);
    throw error;
  }
}
```

### 3. レスポンスの処理
```javascript
const quizText = await generateQuiz("プログラミング", 1);
const quizData = JSON.parse(quizText);

// データベースに保存
await saveQuizToDatabase(quizData);
```

## メッセージの役割（Role）

### 1. system（システム）
```javascript
{
  role: "system",
  content: "あなたはクイズ作成の専門家です。正確で教育的な問題を作成してください。"
}
```
**目的**: AIの人格・役割を定義

### 2. user（ユーザー）
```javascript
{
  role: "user",
  content: "JavaScriptに関する初級レベルのクイズを作成してください。"
}
```
**目的**: 具体的な指示・質問

### 3. assistant（AI）
```javascript
{
  role: "assistant", 
  content: "はい、JavaScriptの初級クイズを作成します。"
}
```
**目的**: AIの前回の回答（会話の継続時）

## パラメータの設定

### 1. max_tokens（最大トークン数）
```javascript
max_tokens: 500  // 生成する文章の最大長
```
- 1トークン ≈ 0.75単語（英語）
- 日本語は1文字 ≈ 2-3トークン
- クイズ1問：約300-500トークン

### 2. temperature（創造性）
```javascript
temperature: 0.7  // 0.0-2.0の範囲
```
- **0.0**: 決定的、毎回同じ回答
- **0.7**: バランス良く多様（推奨）
- **2.0**: 非常に創造的、予測不可能

### 3. top_p（多様性制御）
```javascript
top_p: 1.0  // 0.0-1.0の範囲
```
- **1.0**: 全ての選択肢を考慮
- **0.1**: 上位10%の選択肢のみ

## エラーハンドリング

### 1. よくあるエラー
```javascript
try {
  const response = await openai.chat.completions.create({...});
} catch (error) {
  if (error.status === 401) {
    // APIキーが無効
    console.error('APIキーを確認してください');
  } else if (error.status === 429) {
    // レート制限
    console.error('リクエストが多すぎます');
  } else if (error.status === 500) {
    // OpenAIサーバーエラー
    console.error('OpenAIサーバーエラー');
  }
  throw error;
}
```

### 2. リトライ機能
```javascript
async function generateQuizWithRetry(topic, difficulty, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateQuiz(topic, difficulty);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // 指数バックオフ（待機時間を徐々に増加）
      const waitTime = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
```

## コスト管理

### 1. 料金体系（2024年時点）
```
GPT-3.5 Turbo:
- Input: $0.50 / 1M tokens
- Output: $1.50 / 1M tokens

GPT-4:  
- Input: $30.00 / 1M tokens
- Output: $60.00 / 1M tokens
```

### 2. コスト最適化
```javascript
// 短いプロンプトを使用
const prompt = `${topic}の初級クイズを1問、JSON形式で作成`;

// 不要な説明文を除去
const systemMessage = "クイズ作成専門家。JSON形式で回答。";

// max_tokensを適切に設定
max_tokens: 300  // 必要最小限
```

### 3. 使用量監視
```javascript
// リクエスト前にログ記録
console.log(`[${new Date().toISOString()}] OpenAI API Request: ${topic}`);

// レスポンス後にトークン数記録
console.log(`Tokens used: ${response.usage.total_tokens}`);
```

## セキュリティ対策

### 1. APIキーの保護
```javascript
// ❌ 悪い例：コードに直接記載
const apiKey = "sk-abc123...";

// ✅ 良い例：環境変数
const apiKey = process.env.OPENAI_API_KEY;

// ✅ さらに良い例：存在チェック
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY環境変数が設定されていません');
}
```

### 2. レート制限の実装
```javascript
const rateLimit = require('express-rate-limit');

const openaiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10, // 最大10リクエスト
  message: 'OpenAI APIの使用量が上限に達しました'
});

app.use('/api/quiz/generate', openaiLimiter);
```

### 3. 入力値の検証
```javascript
function validateQuizRequest(topic, difficulty) {
  // トピックの長さ制限
  if (!topic || topic.length > 100) {
    throw new Error('無効なトピックです');
  }
  
  // 難易度の範囲チェック
  if (difficulty < 1 || difficulty > 5) {
    throw new Error('難易度は1-5の範囲で指定してください');
  }
  
  // 危険な文字列の除去
  const sanitizedTopic = topic.replace(/[<>\"']/g, '');
  return { topic: sanitizedTopic, difficulty };
}
```

## プロンプトエンジニアリング

### 1. 効果的なプロンプト設計
```javascript
const createQuizPrompt = (topic, difficulty) => {
  return `
あなたは教育的なクイズを作る専門家です。

以下の仕様で1問のクイズを作成してください：
- トピック: ${topic}
- 難易度: ${difficulty}/5 (1=初級, 5=上級)
- 形式: 4択選択問題
- 要件: 正確で教育的、適切な難易度

必ず以下のJSON形式で回答してください：
{
  "question": "問題文",
  "option_a": "選択肢A",
  "option_b": "選択肢B", 
  "option_c": "選択肢C",
  "option_d": "選択肢D",
  "correct_answer": "A",
  "explanation": "解説文"
}
`;
};
```

### 2. レスポンス品質の向上
```javascript
// より具体的な指示
const prompt = `
${topic}に関するクイズを作成してください。

制約条件:
- 問題文は明確で曖昧さがない
- 選択肢は同程度の長さ
- 正解は1つだけ
- 間違いの選択肢も妥当性がある
- 解説は簡潔で分かりやすい

出力はJSONのみ、追加の説明は不要です。
`;
```

## 実装のベストプラクティス

### 1. 非同期処理の管理
```javascript
// ✅ 適切な非同期処理
app.post('/api/quiz/generate', async (req, res) => {
  try {
    const quiz = await generateQuiz(req.body.topic);
    res.json({ quiz });
  } catch (error) {
    res.status(500).json({ error: 'クイズ生成に失敗しました' });
  }
});
```

### 2. キャッシュの活用
```javascript
const quizCache = new Map();

async function getCachedQuiz(topic, difficulty) {
  const key = `${topic}_${difficulty}`;
  
  if (quizCache.has(key)) {
    return quizCache.get(key);
  }
  
  const quiz = await generateQuiz(topic, difficulty);
  quizCache.set(key, quiz);
  
  return quiz;
}
```

### 3. フォールバック機能
```javascript
async function generateQuizWithFallback(topic, difficulty) {
  try {
    // OpenAI APIを試行
    return await generateQuiz(topic, difficulty);
  } catch (error) {
    console.error('OpenAI API失敗、フォールバックを使用:', error);
    
    // 事前定義されたクイズから選択
    return getPreDefinedQuiz(topic, difficulty);
  }
}
```

## このプロジェクトでの実装方針

### 技術選択
- **モデル**: gpt-3.5-turbo（コスト効率）
- **温度**: 0.7（適度な多様性）
- **最大トークン**: 500（クイズ1問に十分）

### セキュリティ
- 環境変数でAPIキー管理
- レート制限の実装
- 入力値の検証

### ユーザビリティ
- エラー時のフォールバック
- ローディング状態の表示
- 適切なエラーメッセージ

OpenAI APIを適切に活用することで、ユーザーに無限の学習コンテンツを提供できる革新的なクイズアプリを構築できます。