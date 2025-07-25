# HTMLフォームとJavaScript動的制御解説

## HTMLフォームとは？

**HTMLフォーム**は、ユーザーからの入力を受け取るためのHTML要素です。

### 身近な例で理解
**紙の申込書**と同じ概念：
- **入力欄**: テキストボックス、チェックボックス
- **送信**: フォームの内容をサーバーに送信
- **検証**: 必須項目や形式チェック

## フォームの基本構造

### 1. form要素
```html
<form onsubmit="handleSubmit(event)">
  <!-- フォーム内容 -->
  <button type="submit">送信</button>
</form>
```

**重要なポイント**:
- `onsubmit`: フォーム送信時の処理を指定
- `event.preventDefault()`: デフォルトの送信動作を停止

### 2. input要素の種類
```html
<!-- テキスト入力 -->
<input type="text" name="username" required>

<!-- メールアドレス -->
<input type="email" name="email" required>

<!-- パスワード -->
<input type="password" name="password" minlength="8">

<!-- 送信ボタン -->
<button type="submit">送信</button>
```

## JavaScript でのフォーム制御

### 1. フォームデータの取得
```javascript
function handleSubmit(event) {
  event.preventDefault(); // デフォルト送信を停止
  
  // FormDataオブジェクトでフォームデータを取得
  const formData = new FormData(event.target);
  
  const userData = {
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password')
  };
  
  console.log(userData); // フォームの内容を確認
}
```

### 2. 入力値の検証
```javascript
function validateForm(userData) {
  // ユーザー名の長さチェック
  if (userData.username.length < 3) {
    throw new Error('ユーザー名は3文字以上で入力してください');
  }
  
  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    throw new Error('正しいメールアドレス形式で入力してください');
  }
  
  // パスワードの長さチェック
  if (userData.password.length < 8) {
    throw new Error('パスワードは8文字以上で入力してください');
  }
}
```

## 動的なフォーム切り替え

### 1. 表示・非表示の制御
```javascript
function switchToRegister() {
  // ログインフォームを非表示
  document.getElementById('loginForm').style.display = 'none';
  
  // 登録フォームを表示
  document.getElementById('registerForm').style.display = 'block';
  
  // URLハッシュを更新
  location.hash = 'register';
}

function switchToLogin() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  location.hash = '';
}
```

### 2. URLハッシュによる初期表示制御
```javascript
document.addEventListener('DOMContentLoaded', function() {
  // URLのハッシュをチェック
  if (location.hash === '#register') {
    switchToRegister();
  } else {
    switchToLogin();
  }
});
```

## 非同期処理とエラーハンドリング

### 1. async/await パターン
```javascript
async function handleLogin(event) {
  event.preventDefault();
  
  try {
    // ローディング表示
    showLoading('ログイン中...');
    
    // APIにリクエスト送信
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Cookieを含める
      body: JSON.stringify(credentials)
    });
    
    if (response.ok) {
      showSuccess('ログインしました！');
      setTimeout(() => {
        location.href = 'dashboard.html';
      }, 1500);
    } else {
      const error = await response.json();
      throw new Error(error.error);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading();
  }
}
```

### 2. エラー表示の制御
```javascript
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function showSuccess(message) {
  const successDiv = document.getElementById('successMessage');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
}

function clearMessages() {
  document.getElementById('errorMessage').style.display = 'none';
  document.getElementById('successMessage').style.display = 'none';
}
```

## ユーザビリティの向上

### 1. リアルタイムフィードバック
```javascript
// パスワード確認のリアルタイムチェック
document.getElementById('confirmPassword').addEventListener('input', function() {
  const password = document.getElementById('registerPassword').value;
  const confirm = this.value;
  
  const helpText = this.nextElementSibling;
  
  if (confirm && password !== confirm) {
    helpText.textContent = 'パスワードが一致しません';
    helpText.style.color = 'red';
  } else {
    helpText.textContent = '';
  }
});
```

### 2. ボタンの状態制御
```javascript
function showLoading(message) {
  const submitBtns = document.querySelectorAll('button[type="submit"]');
  submitBtns.forEach(btn => {
    btn.disabled = true;
    btn.textContent = message;
  });
}

function hideLoading() {
  const submitBtns = document.querySelectorAll('button[type="submit"]');
  submitBtns.forEach(btn => {
    btn.disabled = false;
  });
  
  // 元のテキストに戻す
  document.querySelector('#loginForm button[type="submit"]').textContent = 'ログイン';
  document.querySelector('#registerForm button[type="submit"]').textContent = '会員登録';
}
```

## セキュリティ考慮事項

### 1. クライアントサイド検証の限界
```javascript
// ❌ クライアントサイドのみの検証は危険
function validatePassword(password) {
  if (password.length < 8) {
    return false; // この検証は簡単に回避される
  }
  return true;
}

// ✅ サーバーサイドでも必ず検証
// フロントエンドの検証はユーザビリティ向上のため
// セキュリティはサーバーサイドで担保
```

### 2. XSS攻撃対策
```javascript
// ❌ 危険：HTMLを直接挿入
element.innerHTML = userInput;

// ✅ 安全：テキストとして挿入
element.textContent = userInput;

// ✅ 安全：適切にエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

## モダンなHTML5機能の活用

### 1. 入力検証属性
```html
<!-- 必須項目 -->
<input type="text" required>

<!-- 最小・最大文字数 -->
<input type="password" minlength="8" maxlength="100">

<!-- パターンマッチング -->
<input type="text" pattern="[a-zA-Z0-9]{3,20}" title="英数字3-20文字">

<!-- 自動フォーカス -->
<input type="text" autofocus>
```

### 2. 自動補完の制御
```html
<!-- 自動補完を有効化 -->
<input type="email" autocomplete="email">
<input type="password" autocomplete="current-password">

<!-- 自動補完を無効化 -->
<input type="password" autocomplete="new-password">
```

## レスポンシブ対応

### 1. ビューポート設定
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 2. モバイル向け最適化
```css
/* フォーム要素のモバイル最適化 */
@media (max-width: 768px) {
  .auth-container {
    padding: 1rem;
    margin: 0 1rem;
  }
  
  input {
    font-size: 16px; /* iOSでズームを防ぐ */
  }
  
  .btn-full {
    padding: 12px; /* タップしやすいサイズ */
  }
}
```

## 実装のベストプラクティス

### 1. プログレッシブエンハンスメント
```html
<!-- JavaScriptなしでも基本機能が動作 -->
<form action="/api/auth/login" method="POST">
  <input type="text" name="username" required>
  <input type="password" name="password" required>
  <button type="submit">ログイン</button>
</form>

<!-- JavaScriptで体験を向上 -->
<script>
  // 非同期送信とリアルタイムフィードバック
</script>
```

### 2. アクセシビリティ配慮
```html
<!-- ラベルと入力欄の関連付け -->
<label for="username">ユーザー名</label>
<input type="text" id="username" name="username">

<!-- エラーメッセージの関連付け -->
<input type="password" aria-describedby="password-help">
<small id="password-help">8文字以上で入力してください</small>

<!-- スクリーンリーダー対応 -->
<div role="alert" id="errorMessage"></div>
```

## このプロジェクトでの実装ポイント

### 採用する技術
- **FormData API**: フォームデータの簡単な取得
- **async/await**: 読みやすい非同期処理
- **fetch API**: モダンなHTTPリクエスト
- **CSS Grid/Flexbox**: レスポンシブレイアウト

### ユーザビリティ向上
- リアルタイムな入力検証
- ローディング状態の表示
- 成功・エラーメッセージの適切な表示
- フォーム間のスムーズな切り替え

### セキュリティ対策
- サーバーサイド検証の実装
- XSS攻撃対策
- CSRF対策（認証Cookieの設定）

HTMLフォームとJavaScriptを組み合わせることで、使いやすく安全なユーザーインターフェースを構築できます。