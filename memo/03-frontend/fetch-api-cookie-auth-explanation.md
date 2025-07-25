# fetch APIとCookie認証解説

## fetch APIとは？

**fetch API**は、JavaScriptでHTTPリクエストを送信するためのモダンなAPIです。

### 身近な例で理解
**郵便システム**で例えると：
- **従来のXMLHttpRequest**: 複雑な手紙の書き方（古い方式）
- **fetch API**: 簡単な宅配便システム（新しい方式）

## 基本的な使用方法

### 1. GET リクエスト
```javascript
// 最もシンプルな形
fetch('/api/quiz')
  .then(response => response.json())
  .then(data => console.log(data));

// async/await を使った書き方（推奨）
async function getQuizzes() {
  try {
    const response = await fetch('/api/quiz');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('エラー:', error);
  }
}
```

### 2. POST リクエスト
```javascript
async function sendData() {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'john',
        password: 'password123'
      })
    });
    
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('エラー:', error);
  }
}
```

## Cookie認証の仕組み

### 従来のトークン認証との違い

#### トークン認証（LocalStorage）
```javascript
// ❌ セキュリティリスクあり
// 1. ログイン時にトークンを保存
localStorage.setItem('token', 'jwt-token');

// 2. APIリクエスト時にトークンを送信
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

**問題点**:
- XSS攻撃でトークンが盗まれる可能性
- JavaScriptからアクセス可能

#### Cookie認証（HTTPOnly Cookie）
```javascript
// ✅ セキュリティが高い
// 1. ログイン時（サーバーが自動でCookieを設定）
fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // 重要：Cookieを含める
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

// 2. APIリクエスト時（Cookieが自動で送信される）
fetch('/api/protected', {
  credentials: 'include' // 重要：Cookieを含める
});
```

**メリット**:
- JavaScriptからアクセス不可（httpOnly属性）
- CSRF攻撃に対する保護機能
- ブラウザが自動で管理

## credentials オプションの重要性

### credentials の値と動作
```javascript
// 'omit': Cookieを送信しない（デフォルト）
fetch('/api/data', { credentials: 'omit' });

// 'same-origin': 同一オリジンのみCookieを送信
fetch('/api/data', { credentials: 'same-origin' });

// 'include': 常にCookieを送信（Cookie認証で必須）
fetch('/api/data', { credentials: 'include' });
```

### なぜ credentials: 'include' が必要？
```javascript
// ❌ Cookieが送信されない
const response = await fetch('/api/auth/me');
// → 401 Unauthorized

// ✅ Cookieが送信される
const response = await fetch('/api/auth/me', {
  credentials: 'include'
});
// → 200 OK with user data
```

## エラーハンドリングパターン

### 1. レスポンスステータスの確認
```javascript
async function loginUser(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    
    // レスポンスの解析
    const data = await response.json();
    
    if (response.ok) {
      // 成功（200-299）
      console.log('ログイン成功:', data);
      return true;
    } else {
      // エラー（400-599）
      throw new Error(data.error || 'ログインに失敗しました');
    }
  } catch (error) {
    // ネットワークエラーやJSONパースエラー
    console.error('ログインエラー:', error);
    throw error;
  }
}
```

### 2. HTTPステータスコード別の処理
```javascript
async function handleApiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      ...options
    });
    
    const data = await response.json();
    
    switch (response.status) {
      case 200:
      case 201:
        return data;
      
      case 401:
        // 認証エラー：ログインページにリダイレクト
        location.href = 'login.html';
        throw new Error('認証が必要です');
      
      case 403:
        // 権限エラー
        throw new Error('アクセス権限がありません');
      
      case 404:
        // 見つからない
        throw new Error('リソースが見つかりません');
      
      case 429:
        // レート制限
        throw new Error('リクエストが多すぎます。しばらく待ってから再試行してください');
      
      case 500:
        // サーバーエラー
        throw new Error('サーバーエラーが発生しました');
      
      default:
        throw new Error(data.error || '予期しないエラーが発生しました');
    }
  } catch (error) {
    console.error('API リクエストエラー:', error);
    throw error;
  }
}
```

## 認証状態の管理

### 1. 認証チェック関数
```javascript
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      return data.user; // ユーザー情報を返す
    } else {
      return null; // 未認証
    }
  } catch (error) {
    console.error('認証確認エラー:', error);
    return null;
  }
}
```

### 2. 認証必須ページの保護
```javascript
async function requireAuth() {
  const user = await checkAuth();
  
  if (!user) {
    // 未認証の場合はログインページにリダイレクト
    console.log('未認証のため、ログインページにリダイレクトします');
    location.href = 'login.html';
    return null;
  }
  
  console.log('認証済みユーザー:', user);
  return user;
}

// 使用例
document.addEventListener('DOMContentLoaded', async function() {
  const user = await requireAuth();
  if (user) {
    // 認証済みの場合のみページ内容を表示
    initializePage(user);
  }
});
```

### 3. 認証済みユーザーのリダイレクト
```javascript
async function redirectIfAuthenticated() {
  const user = await checkAuth();
  
  if (user) {
    // 既にログインしている場合はダッシュボードにリダイレクト
    console.log('既に認証済みのため、ダッシュボードにリダイレクトします');
    location.href = 'dashboard.html';
    return true;
  }
  
  return false;
}

// ログインページで使用
document.addEventListener('DOMContentLoaded', async function() {
  const wasRedirected = await redirectIfAuthenticated();
  if (!wasRedirected) {
    // 未認証の場合のみログインフォームを表示
    showLoginForm();
  }
});
```

## リクエストのキャンセルと重複防止

### 1. AbortController の使用
```javascript
let currentRequest = null;

async function searchWithCancel(query) {
  // 前のリクエストをキャンセル
  if (currentRequest) {
    currentRequest.abort();
  }
  
  // 新しいリクエストを作成
  currentRequest = new AbortController();
  
  try {
    const response = await fetch(`/api/search?q=${query}`, {
      credentials: 'include',
      signal: currentRequest.signal
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('リクエストがキャンセルされました');
    } else {
      throw error;
    }
  }
}
```

### 2. リクエストの重複防止
```javascript
let isLoading = false;

async function submitForm(formData) {
  if (isLoading) {
    console.log('既に処理中です');
    return;
  }
  
  isLoading = true;
  
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await response.json();
    return data;
  } finally {
    isLoading = false;
  }
}
```

## セキュリティ考慮事項

### 1. CSRF対策
```javascript
// Cookieの設定（サーバーサイド）
res.cookie('token', jwtToken, {
  httpOnly: true,    // XSS攻撃対策
  secure: true,      // HTTPS通信でのみ送信
  sameSite: 'strict' // CSRF攻撃対策
});

// フロントエンド側では特別な処理は不要
// ブラウザが自動でCSRF攻撃を防ぐ
```

### 2. XSS攻撃対策
```javascript
// ❌ 危険：HTMLを直接挿入
function displayUserName(name) {
  document.getElementById('userName').innerHTML = name;
}

// ✅ 安全：テキストとして挿入
function displayUserName(name) {
  document.getElementById('userName').textContent = name;
}

// ✅ 安全：適切にエスケープ
function displayUserMessage(message) {
  const div = document.createElement('div');
  div.textContent = message;
  document.getElementById('messages').appendChild(div);
}
```

## パフォーマンス最適化

### 1. リクエストの並列実行
```javascript
async function loadDashboardData() {
  try {
    // 複数のAPIを並列で呼び出し
    const [userStats, quizHistory, topicList] = await Promise.all([
      fetch('/api/user/stats', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/user/history', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/quiz/topics/list', { credentials: 'include' }).then(r => r.json())
    ]);
    
    return { userStats, quizHistory, topicList };
  } catch (error) {
    console.error('ダッシュボードデータ読み込みエラー:', error);
    throw error;
  }
}
```

### 2. キャッシュの活用
```javascript
const cache = new Map();

async function getCachedData(url, cacheTime = 5 * 60 * 1000) { // 5分キャッシュ
  const now = Date.now();
  const cached = cache.get(url);
  
  if (cached && (now - cached.timestamp) < cacheTime) {
    return cached.data;
  }
  
  const response = await fetch(url, { credentials: 'include' });
  const data = await response.json();
  
  cache.set(url, {
    data: data,
    timestamp: now
  });
  
  return data;
}
```

## このプロジェクトでの実装ポイント

### 採用するパターン
- **Cookie認証**: セキュリティを重視
- **async/await**: 読みやすい非同期処理
- **統一されたエラーハンドリング**: ユーザビリティ向上
- **認証状態の自動チェック**: UX改善

### セキュリティ対策
- credentials: 'include' の一貫した使用
- XSS攻撃対策（textContentの使用）
- 適切なエラーメッセージ表示

### ユーザビリティ
- ローディング状態の表示
- 適切なリダイレクト処理
- エラー時の分かりやすいメッセージ

fetch APIとCookie認証を組み合わせることで、セキュアで使いやすい認証システムを構築できます。