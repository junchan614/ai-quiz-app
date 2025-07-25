# quiz.js の説明

**作成するファイル**: `/home/junchan614/projects/ai-quiz-app/public/js/quiz.js`

## 📋 概要
AIクイズ生成アプリのフロントエンドクイズ機能を担当するJavaScriptファイルです。クイズの生成、表示、回答処理、統計管理を統合的に行います。

## 🏗️ 主要な機能構成

### 1. **ページ初期化**
```javascript
document.addEventListener('DOMContentLoaded', function() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return;
    }
    initializeQuizPage();
});
```
**目的**: 認証チェックとページの初期設定

### 2. **グローバル状態管理**
```javascript
let currentQuizzes = [];
let currentQuizIndex = 0;
let sessionStats = {
    totalQuestions: 0,
    correctAnswers: 0,
    currentStreak: 0,
    maxStreak: 0
};
```
**管理データ**:
- 現在のクイズセット
- 進行中の問題番号
- セッション統計（回答数、正解数、連続正解数）

### 3. **AIクイズ生成機能**
```javascript
async function generateAIQuiz(topic, difficulty, count, elements) {
    const endpoint = count === 1 ? '/api/quiz/generate' : '/api/quiz/generate-batch';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topic, difficulty, count })
    });
}
```
**特徴**:
- 単一/複数クイズ生成の自動切り替え
- エラーハンドリング付きAPI通信
- ローディング表示の制御

### 4. **ランダムクイズ取得機能**
```javascript
async function getRandomQuiz(difficulty, elements) {
    const params = new URLSearchParams({ difficulty });
    const response = await fetch(`/api/quiz/random/get?${params}`, {
        credentials: 'include'
    });
}
```
**用途**: 既存データベースからの難易度別ランダム出題

## 🎯 UX実装の詳細

### **インタラクティブな選択肢**
```javascript
function selectOption(optionBtn, elements) {
    // 既存選択を解除
    elements.quizOptions.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    // 新しい選択を設定
    optionBtn.classList.add('selected');
    elements.submitAnswer.disabled = false;
}
```
**視覚的フィードバック**: クリックした選択肢のハイライト表示

### **回答結果の視覚化**
```javascript
options.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.answer === result.correctAnswer) {
        btn.classList.add('correct');
    } else if (btn.dataset.answer === selectedAnswer && !isCorrect) {
        btn.classList.add('incorrect');
    }
});
```
**実装内容**:
- 正解選択肢の緑色表示
- 間違った選択肢の赤色表示
- 回答後の選択肢無効化

### **動的統計更新**
```javascript
function processAnswerResult(result, selectedAnswer, elements) {
    sessionStats.totalQuestions++;
    if (isCorrect) {
        sessionStats.correctAnswers++;
        sessionStats.currentStreak++;
        sessionStats.maxStreak = Math.max(sessionStats.maxStreak, sessionStats.currentStreak);
    } else {
        sessionStats.currentStreak = 0;
    }
    updateStatsDisplay(elements);
}
```
**リアルタイム更新**: 回答するたびに統計が即座に更新

## 🔄 状態遷移の制御

### **画面遷移パターン**
1. **生成フォーム** → **ローディング** → **クイズ表示**
2. **クイズ表示** → **結果表示** → **次の問題 or 生成画面**

### **セクション表示制御**
```javascript
function displayQuiz(quiz, elements) {
    hideLoading(elements);
    elements.quizGenerator.classList.add('hidden');
    elements.resultSection.classList.add('hidden');
    elements.quizSection.classList.remove('hidden');
}
```
**実装方針**: `hidden`クラスによるセクションの表示/非表示制御

## 🛠️ エラーハンドリング

### **ユーザーフレンドリーなエラー表示**
```javascript
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // 5秒後に自動で非表示
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}
```
**特徴**:
- 非侵入的なメッセージ表示
- 自動消去機能
- 手動クローズボタン対応

### **API通信エラーの処理**
```javascript
try {
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'デフォルトエラーメッセージ');
    }
} catch (error) {
    console.error('詳細エラー:', error);
    showError(error.message);
    hideLoading(elements);
}
```
**段階的エラー処理**:
1. HTTPステータスエラーの検出
2. サーバーエラーメッセージの表示
3. ネットワークエラーのフォールバック

## 🎨 ユーザビリティの工夫

### **キーボードショートカット**
```javascript
elements.topicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.generateBtn.click();
    }
});
```
**効率化**: Enterキーでクイズ生成を実行

### **入力値検証**
```javascript
if (!topic) {
    showError('トピックを入力してください');
    return;
}
```
**ユーザー支援**: 必須項目の事前チェック

### **成功フィードバック**
```javascript
if (isCorrect) {
    showSuccess('正解です！');
} else {
    showError('不正解でした。次も頑張りましょう！');
}
```
**モチベーション維持**: 正解/不正解に対する適切なフィードバック

## 🔧 技術実装のポイント

### **非同期処理の管理**
- `async/await`による読みやすいコード
- Promise chaining の回避
- エラーハンドリングの一元化

### **DOM操作の効率化**
- 要素の一括取得と再利用
- クラス操作による状態管理
- イベント委譲の活用

### **メモリ管理**
- グローバル変数の最小化
- イベントリスナーの適切な設定
- 不要なDOM参照の回避

## 🚀 パフォーマンス最適化

### **ローディング状態の管理**
- ユーザーの待機体験向上
- 重複リクエストの防止
- 適切なフィードバック提供

### **統計計算の最適化**
- リアルタイム計算
- 整数演算の活用
- 不要な再計算の回避

このJavaScriptファイルにより、ユーザーは直感的で応答性の高いクイズ体験を享受でき、AIによる学習支援を効果的に活用できます。