// 認証関連のJavaScript関数

// ユーザー登録
async function register(username, email, password) {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Cookieを含める
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('会員登録成功:', data);
      return true;
    } else {
      throw new Error(data.error || '会員登録に失敗しました');
    }
  } catch (error) {
    console.error('会員登録エラー:', error);
    throw error;
  }
}

// ユーザーログイン
async function login(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Cookieを含める
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('ログイン成功:', data);
      return true;
    } else {
      throw new Error(data.error || 'ログインに失敗しました');
    }
  } catch (error) {
    console.error('ログインエラー:', error);
    throw error;
  }
}

// ログアウト
async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      console.log('ログアウト成功');
      // ホームページにリダイレクト
      location.href = 'index.html';
      return true;
    } else {
      console.error('ログアウトに失敗しました');
      return false;
    }
  } catch (error) {
    console.error('ログアウトエラー:', error);
    return false;
  }
}

// 認証状態の確認
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      return data.user;
    } else {
      return null;
    }
  } catch (error) {
    console.error('認証確認エラー:', error);
    return null;
  }
}

// 認証が必要なページの保護
async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    // 未認証の場合はログインページにリダイレクト
    location.href = 'login.html';
    return null;
  }
  return user;
}

// 認証済みユーザーのリダイレクト（ログインページなどで使用）
async function redirectIfAuthenticated() {
  const user = await checkAuth();
  if (user) {
    // 認証済みの場合はダッシュボードにリダイレクト
    location.href = 'dashboard.html';
    return true;
  }
  return false;
}

// 同期的な認証状態確認（quiz.jsで使用）
function isAuthenticated() {
  // HTTPOnlyクッキーのため、実際にはAPIで確認する必要がある
  // 一時的に常にtrueを返して、実際の認証チェックは各API呼び出しで行う
  return true;
}

// 非同期の認証状態確認
async function verifyAuthentication() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    console.error('認証確認エラー:', error);
    return false;
  }
}