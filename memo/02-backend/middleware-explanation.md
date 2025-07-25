# ミドルウェア解説

## ミドルウェアとは？

**ミドルウェア**は、リクエストとレスポンスの間で実行される関数です。

### 身近な例で理解
**空港のセキュリティチェック**で例えると：
- **リクエスト**: 乗客が搭乗ゲートに向かう
- **ミドルウェア**: セキュリティチェック（荷物検査、身分確認）
- **レスポンス**: 搭乗ゲートに到達（または入場拒否）

## Express.jsでのミドルウェアの仕組み

### 基本的な流れ
```
1. クライアントがリクエスト送信
2. ミドルウェア1実行
3. ミドルウェア2実行
4. ミドルウェア3実行
5. 最終的なルートハンドラー実行
6. レスポンス送信
```

### ミドルウェアの関数形式
```javascript
function middleware(req, res, next) {
  // 処理を実行
  console.log('ミドルウェアが実行されました');
  
  // 次のミドルウェアに処理を渡す
  next();
}
```

**重要なポイント**:
- `req`: リクエストオブジェクト
- `res`: レスポンスオブジェクト  
- `next`: 次のミドルウェアを呼び出す関数

## 認証ミドルウェアの役割

### 目的
- **保護されたルートの認証チェック**
- **不正なアクセスの防止**
- **ユーザー情報の自動取得**

### 処理の流れ
```
1. クッキーからJWTトークンを取得
2. トークンの存在確認
3. トークンの検証（署名・有効期限）
4. ユーザー情報をrequestオブジェクトに追加
5. 次の処理に進む
```

## 実装パターンの解説

### 1. 基本的な認証ミドルウェア
```javascript
const authenticateToken = (req, res, next) => {
  // 1. Cookieからトークンを取得
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ error: 'アクセストークンがありません' });
  }
  
  try {
    // 2. トークンを検証・デコード
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. ユーザー情報をrequestに追加
    req.user = decoded;
    
    // 4. 次のミドルウェアに処理を渡す
    next();
  } catch (error) {
    return res.status(403).json({ error: '無効なトークンです' });
  }
};
```

### 2. 使用方法
```javascript
// 認証が必要なルートで使用
app.get('/api/protected', authenticateToken, (req, res) => {
  // req.userでユーザー情報にアクセス可能
  const userId = req.user.userId;
  res.json({ message: `こんにちは、ユーザーID: ${userId}` });
});
```

## ミドルウェアの種類

### 1. アプリケーションレベルミドルウェア
```javascript
// 全てのリクエストに適用
app.use((req, res, next) => {
  console.log('リクエスト時刻:', new Date());
  next();
});
```

### 2. ルーターレベルミドルウェア
```javascript
// 特定のルーターにのみ適用
router.use('/admin', adminAuthMiddleware);
```

### 3. エラーハンドリングミドルウェア
```javascript
// エラー処理専用（引数が4つ）
app.use((error, req, res, next) => {
  console.error('エラー:', error);
  res.status(500).json({ error: 'サーバーエラー' });
});
```

### 4. 組み込みミドルウェア
```javascript
app.use(express.json());        // JSON解析
app.use(express.static('public')); // 静的ファイル提供
app.use(cookieParser());        // Cookie解析
```

## JWTトークン検証の詳細

### 1. トークンの取得場所
```javascript
// Cookieから取得（推奨：セキュリティが高い）
const token = req.cookies.token;

// Authorizationヘッダーから取得
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

// クエリパラメータから取得（非推奨：ログに残る）
const token = req.query.token;
```

### 2. エラーの種類別処理
```javascript
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
} catch (error) {
  if (error.name === 'JsonWebTokenError') {
    // 不正なトークン形式
    return res.status(401).json({ error: '無効なトークンです' });
  }
  
  if (error.name === 'TokenExpiredError') {
    // トークン期限切れ
    return res.status(401).json({ error: 'トークンの有効期限が切れています' });
  }
  
  if (error.name === 'NotBeforeError') {
    // トークンがまだ有効でない
    return res.status(401).json({ error: 'トークンがまだ有効ではありません' });
  }
  
  // その他のエラー
  return res.status(500).json({ error: '認証処理でエラーが発生しました' });
}
```

## 高度なミドルウェアパターン

### 1. ロール（権限）ベース認証
```javascript
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '認証が必要です' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    
    next();
  };
};

// 使用例
app.get('/api/admin', authenticateToken, requireRole(['admin']), (req, res) => {
  res.json({ message: '管理者専用ページ' });
});
```

### 2. オプショナル認証
```javascript
const optionalAuth = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    // トークンがなくても処理を続行
    req.user = null;
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    // エラーでも処理を続行
    req.user = null;
  }
  
  next();
};
```

### 3. リクエスト制限ミドルウェア
```javascript
const rateLimitByUser = (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  const userId = req.user.userId;
  const requestCount = userRequestCounts.get(userId) || 0;
  
  if (requestCount > 100) {
    return res.status(429).json({ 
      error: 'リクエスト上限に達しました' 
    });
  }
  
  userRequestCounts.set(userId, requestCount + 1);
  next();
};
```

## セキュリティ考慮事項

### 1. トークンの安全な保存
```javascript
// ✅ 良い例：HTTPOnlyクッキー
res.cookie('token', token, {
  httpOnly: true,    // JavaScriptからアクセス不可
  secure: true,      // HTTPS通信のみ
  sameSite: 'strict' // CSRF攻撃防止
});

// ❌ 悪い例：LocalStorageに保存（XSS攻撃に脆弱）
localStorage.setItem('token', token);
```

### 2. エラーメッセージの統一
```javascript
// ✅ 良い例：攻撃者に情報を与えない
if (!user || !isValidPassword) {
  return res.status(401).json({ 
    error: 'ユーザー名またはパスワードが間違っています' 
  });
}

// ❌ 悪い例：攻撃者に有用な情報を与える
if (!user) {
  return res.status(401).json({ error: 'ユーザーが見つかりません' });
}
if (!isValidPassword) {
  return res.status(401).json({ error: 'パスワードが間違っています' });
}
```

### 3. 秘密鍵の管理
```javascript
// ✅ 良い例：環境変数から取得
const JWT_SECRET = process.env.JWT_SECRET;

// ❌ 悪い例：コードに直接記載
const JWT_SECRET = "my-secret-key";
```

## デバッグとテスト

### 1. ログ記録
```javascript
const authenticateToken = (req, res, next) => {
  console.log(`認証チェック: ${req.method} ${req.path}`);
  
  const token = req.cookies.token;
  
  if (!token) {
    console.log('トークンなし');
    return res.status(401).json({ error: 'アクセストークンがありません' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`認証成功: ユーザーID ${decoded.userId}`);
    req.user = decoded;
    next();
  } catch (error) {
    console.log(`認証失敗: ${error.message}`);
    return res.status(403).json({ error: '無効なトークンです' });
  }
};
```

### 2. テスト用のモック
```javascript
// テスト環境用の認証スキップ
const authenticateToken = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    req.user = { userId: 1, username: 'test_user' };
    return next();
  }
  
  // 通常の認証処理
  // ...
};
```

## このプロジェクトでの実装方針

### 採用する認証方式
- **トークン保存**: HTTPOnlyクッキー
- **エラーハンドリング**: 統一されたエラーメッセージ
- **ログ記録**: 認証の試行履歴を記録
- **権限管理**: 現時点では単純な認証済み/未認証のみ

### セキュリティ対策
- JWTトークンの適切な検証
- エラー情報の漏洩防止
- レート制限との組み合わせ

ミドルウェアを使うことで、認証ロジックを再利用可能な形で実装し、保護されたAPIエンドポイントを効率的に管理できます。