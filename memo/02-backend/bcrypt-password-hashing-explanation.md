# bcryptパスワードハッシュ化解説

## bcryptとは？

**bcrypt**は、パスワードを安全にハッシュ化（暗号化）するためのライブラリです。

### 身近な例で理解
**金庫の組み合わせ**で例えると：
- **平文保存**: 組み合わせを紙に「1234」と書いて保存（危険）
- **単純ハッシュ**: 「1234」を「abcd」に変換して保存（解読可能）
- **bcrypt**: 「1234」を複雑な手順で「$2b$12$abc...xyz」に変換（解読困難）

## なぜパスワードハッシュ化が必要？

### 平文保存の危険性
```javascript
// ❌ 絶対にやってはいけない例
const user = {
  username: "john",
  password: "mypassword123"  // 平文で保存
}
```

**問題点**:
- データベースが漏洩した時、全パスワードが露出
- 開発者・管理者がユーザーのパスワードを見ることができる
- 法的・倫理的問題

### ハッシュ化の仕組み
```javascript
// ✅ 安全な保存方法
const hashedPassword = await bcrypt.hash("mypassword123", 12)
// 結果: "$2b$12$LGIabCdE...複雑な文字列"

const user = {
  username: "john",
  password_hash: hashedPassword  // ハッシュ化して保存
}
```

## bcryptの特徴

### 1. 一方向関数（ハッシュ関数）
- **入力→出力**: 簡単（0.1秒）
- **出力→入力**: 極めて困難（数年〜不可能）

```javascript
// パスワード → ハッシュ（簡単）
const hash = await bcrypt.hash("password123", 12)

// ハッシュ → パスワード（不可能）
// 元のパスワードを復元することはできない
```

### 2. ソルト（salt）自動生成
**ソルト**とは、パスワードに追加するランダムな文字列

```javascript
// 同じパスワードでも毎回異なるハッシュが生成される
const hash1 = await bcrypt.hash("password123", 12)
// → "$2b$12$abcdefg...xyz"

const hash2 = await bcrypt.hash("password123", 12)
// → "$2b$12$hijklmn...uvw"  ←異なる結果
```

**レインボーテーブル攻撃**を防止：
- 事前計算された「パスワード→ハッシュ」対応表での攻撃を無効化

### 3. コストファクター（ラウンド数）
計算の複雑さを調整可能：

```javascript
// ラウンド数が多いほど安全だが、処理時間も長くなる
await bcrypt.hash("password", 10)  // 約0.1秒
await bcrypt.hash("password", 12)  // 約0.3秒
await bcrypt.hash("password", 14)  // 約1.2秒
```

## 実装方法

### 1. パスワードのハッシュ化
```javascript
const bcrypt = require('bcrypt')

// ユーザー登録時
async function registerUser(username, email, password) {
  try {
    // パスワードをハッシュ化（ラウンド数12を推奨）
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    
    // データベースに保存
    const user = await db.run(`
      INSERT INTO users (username, email, password_hash) 
      VALUES (?, ?, ?)
    `, [username, email, hashedPassword])
    
    return user
  } catch (error) {
    console.error('登録エラー:', error)
    throw error
  }
}
```

### 2. パスワードの検証
```javascript
// ユーザーログイン時
async function loginUser(username, password) {
  try {
    // データベースからユーザー情報を取得
    const user = await db.get(`
      SELECT * FROM users WHERE username = ?
    `, [username])
    
    if (!user) {
      throw new Error('ユーザーが見つかりません')
    }
    
    // パスワードを検証
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    
    if (!isValidPassword) {
      throw new Error('パスワードが間違っています')
    }
    
    return user
  } catch (error) {
    console.error('ログインエラー:', error)
    throw error
  }
}
```

## ソルトラウンド数の選択

### 現在の推奨値（2024年）
```javascript
const saltRounds = 12  // 推奨
```

### ラウンド数別の処理時間と安全性
| ラウンド数 | 処理時間 | セキュリティレベル | 用途 |
|-----------|---------|------------------|------|
| 8 | 0.025秒 | 低 | テスト環境のみ |
| 10 | 0.1秒 | 中 | 軽量アプリ |
| 12 | 0.3秒 | 高 | **推奨（本プロジェクト）** |
| 14 | 1.2秒 | 最高 | 高セキュリティアプリ |

### 選択基準
- **ユーザー体験**: ログインが1秒以内で完了
- **セキュリティ**: 攻撃者が総当たり攻撃を実行困難
- **サーバー負荷**: 同時ログインユーザー数を考慮

## セキュリティベストプラクティス

### 1. パスワード強度の検証
```javascript
function validatePassword(password) {
  const minLength = 8
  const hasNumber = /\d/.test(password)
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  if (password.length < minLength) {
    throw new Error('パスワードは8文字以上である必要があります')
  }
  
  if (!hasNumber || !hasLetter) {
    throw new Error('パスワードは英数字を含む必要があります')
  }
  
  return true
}
```

### 2. ログイン試行回数の制限
```javascript
const loginAttempts = new Map()

async function loginWithRateLimit(username, password) {
  const attempts = loginAttempts.get(username) || 0
  
  if (attempts >= 5) {
    throw new Error('ログイン試行回数が上限に達しました。30分後に再試行してください')
  }
  
  try {
    const user = await loginUser(username, password)
    loginAttempts.delete(username)  // 成功時はカウントリセット
    return user
  } catch (error) {
    loginAttempts.set(username, attempts + 1)
    throw error
  }
}
```

### 3. パスワード変更時の検証
```javascript
async function changePassword(userId, oldPassword, newPassword) {
  // 1. 現在のパスワードを検証
  const user = await getUserById(userId)
  const isValidOldPassword = await bcrypt.compare(oldPassword, user.password_hash)
  
  if (!isValidOldPassword) {
    throw new Error('現在のパスワードが間違っています')
  }
  
  // 2. 新しいパスワードの強度チェック
  validatePassword(newPassword)
  
  // 3. 古いパスワードと同じでないかチェック
  const isSamePassword = await bcrypt.compare(newPassword, user.password_hash)
  if (isSamePassword) {
    throw new Error('新しいパスワードは現在のパスワードと異なる必要があります')
  }
  
  // 4. 新しいパスワードをハッシュ化して保存
  const newHashedPassword = await bcrypt.hash(newPassword, 12)
  await updateUserPassword(userId, newHashedPassword)
}
```

## よくある間違いと対策

### 1. ❌ 同期処理の使用
```javascript
// 悪い例：ブロッキング処理
const hashedPassword = bcrypt.hashSync(password, 12)  // UIが固まる

// 良い例：非同期処理
const hashedPassword = await bcrypt.hash(password, 12)  // ノンブロッキング
```

### 2. ❌ 低すぎるラウンド数
```javascript
// 悪い例：セキュリティが低い
const hashedPassword = await bcrypt.hash(password, 4)

// 良い例：適切なセキュリティレベル
const hashedPassword = await bcrypt.hash(password, 12)
```

### 3. ❌ エラー処理の不備
```javascript
// 悪い例：エラー詳細の漏洩
catch (error) {
  res.json({ error: error.message })  // 攻撃者に情報を与える
}

// 良い例：安全なエラーメッセージ
catch (error) {
  console.error('認証エラー:', error)
  res.status(401).json({ error: 'ユーザー名またはパスワードが間違っています' })
}
```

## パフォーマンス最適化

### 1. 並行処理の活用
```javascript
// 複数のパスワード検証を並行実行
async function validateMultiplePasswords(credentials) {
  const promises = credentials.map(async ({ username, password }) => {
    const user = await getUserByUsername(username)
    const isValid = await bcrypt.compare(password, user.password_hash)
    return { username, isValid }
  })
  
  return await Promise.all(promises)
}
```

### 2. キャッシュの活用（注意深く）
```javascript
// ⚠️ 注意：セキュリティリスクを理解した上で使用
const passwordCache = new Map()

async function cachedPasswordCheck(password, hash) {
  const cacheKey = `${password}_${hash}`
  
  if (passwordCache.has(cacheKey)) {
    return passwordCache.get(cacheKey)
  }
  
  const result = await bcrypt.compare(password, hash)
  
  // 短時間のみキャッシュ（メモリリークを防ぐ）
  passwordCache.set(cacheKey, result)
  setTimeout(() => passwordCache.delete(cacheKey), 60000)  // 1分後に削除
  
  return result
}
```

## このプロジェクトでの実装方針

### 採用する設定
```javascript
const BCRYPT_ROUNDS = 12  // セキュリティと性能のバランス
```

### セキュリティ対策
- パスワード強度の検証
- ログイン試行回数の制限
- 安全なエラーメッセージの表示
- 非同期処理の使用

### パフォーマンス考慮
- 適切なラウンド数の選択
- エラーレスポンスの統一化
- ログ記録によるセキュリティ監視

bcryptを使うことで、ユーザーのパスワードを安全に保護し、現代的なセキュリティ基準を満たすWebアプリケーションを構築できます。