# OpenAI連携サービス実装解説

## サービス層とは？

**サービス層**は、ビジネスロジックを担当するアプリケーションの層です。

### 身近な例で理解
**レストランの厨房**で例えると：
- **ルーター（ホール）**: お客様からの注文を受ける
- **サービス（厨房）**: 実際に料理を作る専門部署
- **データベース（冷蔵庫）**: 材料を保管する場所

## ファイル構造の役割

### services/openai.js の位置づけ
```
ai-quiz-app/
├── routes/          # ルーティング層
│   └── quiz.js      # HTTPリクエストの受付
├── services/        # ビジネスロジック層
│   └── openai.js    # OpenAI API連携の専門処理
├── middleware/      # 共通処理層
└── database/        # データ永続化層
```

**分離のメリット**:
- コードの再利用性向上
- テストの容易さ
- 保守性の向上

## 主要な関数の説明

### 1. createQuizPrompt()
```javascript
function createQuizPrompt(topic, difficulty = 1) {
  return `
あなたは教育的なクイズを作る専門家です。

以下の仕様で1問のクイズを作成してください：
- トピック: ${topic}
- 難易度: ${difficulty}/5
- 形式: 4択選択問題
  `;
}
```

**目的**: AIに送る指示文（プロンプト）の生成
**工夫点**:
- 明確な役割定義（「専門家」として設定）
- 具体的な出力形式の指定
- 日本語での出力を明示

### 2. generateQuiz()
```javascript
async function generateQuiz(topic, difficulty = 1) {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "あなたはクイズ作成の専門家です。"
      },
      {
        role: "user", 
        content: createQuizPrompt(topic, difficulty)
      }
    ],
    max_tokens: 500,
    temperature: 0.7
  });
}
```

**パラメータ解説**:
- **model**: "gpt-3.5-turbo"（コスト効率重視）
- **max_tokens**: 500（クイズ1問に十分な長さ）
- **temperature**: 0.7（適度な創造性）

### 3. generateQuizWithRetry()
```javascript
async function generateQuizWithRetry(topic, difficulty = 1, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateQuiz(topic, difficulty);
    } catch (error) {
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}
```

**指数バックオフ**:
- 1回目失敗: 1秒待機
- 2回目失敗: 2秒待機  
- 3回目失敗: 4秒待機

**メリット**: 一時的なネットワークエラーやAPI制限を回避

## エラーハンドリングの詳細

### HTTPステータスコード別処理
```javascript
if (error.status === 401) {
  throw new Error('OpenAI APIキーが無効です');
} else if (error.status === 429) {
  throw new Error('APIの利用制限に達しました');
} else if (error.status === 500) {
  throw new Error('OpenAIサーバーでエラーが発生しました');
}
```

**なぜ重要？**:
- ユーザーに分かりやすいエラーメッセージ
- 問題の原因を特定しやすく
- 適切な対処法をユーザーに示せる

### JSON解析エラーの処理
```javascript
try {
  // レスポンスからJSON部分を抽出
  const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : responseContent;
  quizData = JSON.parse(jsonString);
} catch (parseError) {
  throw new Error('AIからの回答をJSON形式で解析できませんでした');
}
```

**AIの回答の特徴**:
- 時々説明文が含まれる
- ```json ``` で囲まれることがある
- 完全なJSONでない場合がある

**対策**: 正規表現でJSON部分のみを抽出

## データ検証の実装

### 必須フィールドの確認
```javascript
const requiredFields = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];
for (const field of requiredFields) {
  if (!quizData[field]) {
    throw new Error(`必須フィールド「${field}」が不足しています`);
  }
}
```

### 正解の妥当性チェック
```javascript
if (!['A', 'B', 'C', 'D'].includes(quizData.correct_answer)) {
  throw new Error('正解は A, B, C, D のいずれかである必要があります');
}
```

**重要性**: AIが時々不完全な回答を生成するため、データの整合性を保証

## パフォーマンス最適化

### 1. 並列処理の制御
```javascript
async function generateMultipleQuizzes(topic, difficulty = 1, count = 5) {
  for (let i = 0; i < count; i++) {
    const quiz = await generateQuizWithRetry(topic, difficulty);
    
    // APIレート制限を避けるため待機
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

**並列 vs 順次処理**:
- **並列処理**: 高速だがAPIレート制限に抵触
- **順次処理**: 安全だが時間がかかる
- **採用方針**: 安定性を重視して順次処理

### 2. ログ出力による監視
```javascript
console.log(`📊 トークン使用量: ${completion.usage.total_tokens}`);
console.log(`🤖 OpenAI APIでクイズ生成開始: ${topic}`);
```

**目的**: 
- API使用量の把握
- デバッグ情報の提供
- システム監視の支援

## セキュリティ考慮事項

### 1. 環境変数の検証
```javascript
if (!process.env.OPENAI_API_KEY) {
  console.error('⚠️  OPENAI_API_KEY環境変数が設定されていません');
  process.exit(1);
}
```

**早期失敗の原則**: 設定不備は起動時に検出

### 2. 入力値の検証
```javascript
// topic, difficultyの妥当性チェック
// SQLインジェクション対策
// XSS攻撃対策
```

**実装箇所**: 通常はルーター層で実装（今回は簡略化）

## テスト機能の実装

### testOpenAIConnection()
```javascript
async function testOpenAIConnection() {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: "この接続テストメッセージに「接続成功」と返答してください。"
      }
    ],
    max_tokens: 50
  });
}
```

**用途**:
- 開発時の接続確認
- デプロイ後の動作確認
- APIキーの妥当性検証

## モジュール設計パターン

### CommonJS形式のエクスポート
```javascript
module.exports = {
  generateQuiz,
  generateQuizWithRetry,
  generateMultipleQuizzes,
  testOpenAIConnection
};
```

**設計思想**:
- 必要な関数のみを公開
- 内部実装の隠蔽
- テストのしやすさ

### 使用例（ルーターから）
```javascript
const { generateQuizWithRetry } = require('../services/openai');

app.post('/api/quiz/generate', async (req, res) => {
  try {
    const quiz = await generateQuizWithRetry(req.body.topic, req.body.difficulty);
    res.json({ quiz });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 実際の運用での注意点

### 1. コスト管理
- **監視**: トークン使用量のログ記録
- **制限**: ユーザーあたりの生成回数制限
- **最適化**: プロンプトの簡潔化

### 2. 品質管理
- **検証**: 生成されたクイズの妥当性チェック
- **フィードバック**: ユーザーからの品質評価
- **改善**: プロンプトの継続的な改良

### 3. 可用性の確保
- **フォールバック**: API障害時の代替手段
- **キャッシュ**: 人気トピックの事前生成
- **監視**: API応答時間とエラー率の追跡

このサービス層の実装により、OpenAI APIとの連携を安全で効率的に行い、高品質なクイズ生成機能を提供できます。