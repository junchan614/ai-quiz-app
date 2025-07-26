const jwt = require('jsonwebtoken');

// JWT秘密鍵の検証
const validateJWTSecret = () => {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (process.env.NODE_ENV === 'production' && jwtSecret.length < 32) {
    throw new Error('Production environment requires a strong JWT_SECRET (minimum 32 characters)');
  }
  
  return jwtSecret;
};

// 起動時に秘密鍵を検証
const JWT_SECRET = validateJWTSecret();

// JWT認証ミドルウェア
const authenticateToken = (req, res, next) => {
  try {
    // 1. Cookieからトークンを取得
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        error: 'アクセストークンがありません。ログインしてください。'
      });
    }
    
    // 2. トークンを検証・デコード
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 3. ユーザー情報をrequestオブジェクトに追加
    req.user = {
      userId: decoded.userId,
      username: decoded.username
    };
    
    // 4. 次のミドルウェアまたはルートハンドラーに処理を渡す
    next();
    
  } catch (error) {
    // エラーの種類に応じた処理
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '無効なトークンです。再度ログインしてください。'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'トークンの有効期限が切れています。再度ログインしてください。'
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        error: 'トークンがまだ有効ではありません。'
      });
    }
    
    // その他の予期しないエラー
    console.error('認証エラー:', error);
    return res.status(500).json({
      error: '認証処理でエラーが発生しました。'
    });
  }
};

// オプショナル認証ミドルウェア（認証されていなくても処理を続行）
const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      username: decoded.username
    };
    
  } catch (error) {
    // エラーが発生してもリクエストを継続
    req.user = null;
  }
  
  next();
};

module.exports = authenticateToken;
module.exports.optionalAuth = optionalAuth;