# JWT認証システム解説

## JWTとは？

**JWT（JSON Web Token）**は、ユーザー認証のためのモダンなトークンベース認証システムです。

### 身近な例で理解
**映画館の入場券**で例えると：
- **従来のセッション**: 映画館が「お客様番号123番が入場中」という記録を管理
- **JWT**: 入場券自体に「映画名、座席、有効期限」をすべて記載し、偽造防止の特殊印刷

## JWTの構造

### 3つの部分で構成
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**ヘッダー.ペイロード.署名** の3つをドット（.）で区切る

### 1. ヘッダー（Header）
```json
{
  "alg": "HS256",  // 暗号化アルゴリズム
  "typ": "JWT"     // トークンタイプ
}
```

### 2. ペイロード（Payload）
```json
{
  "sub": "1234567890",           // ユーザーID
  "name": "John Doe",            // ユーザー名
  "iat": 1516239022,             // 発行時刻
  "exp": 1516242622              // 有効期限
}
```

### 3. 署名（Signature）
- 秘密鍵を使ってヘッダーとペイロードを暗号化
- **改ざん検証**のために使用

## 従来のセッションとの違い

### セッション認証の仕組み
```
1. ユーザーがログイン
2. サーバーがセッションIDを生成・保存
3. ブラウザにセッションIDをCookieで送信
4. 以降のリクエストでセッションIDを確認
```

**問題点**:
- サーバーがセッション情報を保存する必要がある
- 複数サーバー運用時に共有が困難
- メモリ使用量が増加

### JWT認証の仕組み
```
1. ユーザーがログイン
2. サーバーがJWTトークンを生成・送信
3. ブラウザがトークンを保存
4. 以降のリクエストでトークンを送信・検証
```

**メリット**:
- サーバーが状態を保持しない（ステートレス）
- 複数サーバー間で共有が簡単
- メモリ使用量を削減

## セキュリティの重要ポイント

### 1. 秘密鍵の管理
```javascript
// ❌ 悪い例：簡単な秘密鍵
const JWT_SECRET = "secret"

// ✅ 良い例：強力なランダム文字列
const JWT_SECRET = "aB3$mK9@pL5#qR8*vN2&wX7%yZ4!eH6"
```

### 2. 有効期限の設定
```javascript
// ❌ 悪い例：無期限
jwt.sign(payload, secret)

// ✅ 良い例：適切な有効期限
jwt.sign(payload, secret, { expiresIn: '24h' })
```

### 3. トークンの保存場所
- **httpOnly Cookie**: XSS攻撃に強い（推奨）
- **LocalStorage**: XSS攻撃に弱い
- **SessionStorage**: XSS攻撃に弱い

## 実装の流れ

### 1. ユーザー登録・ログイン
```javascript
// ユーザー登録
app.post('/api/auth/register', async (req, res) => {
  // 1. パスワードをハッシュ化
  const hashedPassword = await bcrypt.hash(password, 12)
  
  // 2. ユーザーをデータベースに保存
  const user = await createUser(username, email, hashedPassword)
  
  // 3. JWTトークンを生成
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
  
  // 4. クッキーでトークンを送信
  res.cookie('token', token, { httpOnly: true })
  res.json({ success: true })
})
```

### 2. 認証ミドルウェア
```javascript
const authenticateToken = (req, res, next) => {
  // 1. Cookieからトークンを取得
  const token = req.cookies.token
  
  if (!token) {
    return res.status(401).json({ error: 'アクセストークンがありません' })
  }
  
  try {
    // 2. トークンを検証・デコード
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(403).json({ error: '無効なトークンです' })
  }
}
```

### 3. 保護されたルート
```javascript
// 認証が必要なAPI
app.get('/api/quiz/generate', authenticateToken, (req, res) => {
  // req.userでユーザー情報にアクセス可能
  const userId = req.user.userId
  // クイズ生成処理...
})
```

## フロントエンドでの実装

### ログイン処理
```javascript
async function login(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Cookieを含める
      body: JSON.stringify({ username, password })
    })
    
    if (response.ok) {
      // ログイン成功：ダッシュボードにリダイレクト
      window.location.href = '/dashboard.html'
    } else {
      // エラー処理
      const error = await response.json()
      showError(error.message)
    }
  } catch (error) {
    console.error('ログインエラー:', error)
  }
}
```

### 認証状態の確認
```javascript
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    })
    
    if (response.ok) {
      const user = await response.json()
      return user
    } else {
      // 未認証：ログインページにリダイレクト
      window.location.href = '/login.html'
    }
  } catch (error) {
    console.error('認証確認エラー:', error)
  }
}
```

## よくある実装パターン

### 1. アクセストークン + リフレッシュトークン
```javascript
// アクセストークン：短い有効期限（15分）
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' })

// リフレッシュトークン：長い有効期限（7日）
const refreshToken = jwt.sign(payload, secret, { expiresIn: '7d' })
```

### 2. ロール基準認証
```javascript
const payload = {
  userId: user.id,
  username: user.username,
  role: user.role // 'admin', 'user' など
}

// 管理者のみアクセス可能なミドルウェア
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' })
  }
  next()
}
```

## トラブルシューティング

### よくあるエラーと対処法

#### 1. "jwt malformed" エラー
- **原因**: 不正な形式のトークン
- **対処**: トークンの形式を確認、再ログインを促す

#### 2. "jwt expired" エラー
- **原因**: トークンの有効期限切れ
- **対処**: 新しいトークンの発行、リフレッシュトークン実装

#### 3. "invalid signature" エラー
- **原因**: 秘密鍵の不一致
- **対処**: 環境変数の設定確認

#### 4. CORS エラー
- **原因**: Cross-Origin リクエストでCookieが送信されない
- **対処**: `credentials: 'include'` の設定

## このプロジェクトでの実装方針

### 採用する方式
- **トークン保存**: httpOnly Cookie（セキュリティ重視）
- **有効期限**: 24時間（学習用途のため長め）
- **リフレッシュトークン**: 実装しない（シンプル重視）

### セキュリティ対策
- 強力な秘密鍵の使用
- 適切な有効期限設定
- HTTPS通信（本番環境）
- CORS設定の適切な管理

JWTを使うことで、モダンでスケーラブルな認証システムを構築できます。