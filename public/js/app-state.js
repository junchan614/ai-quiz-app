// アプリケーション状態管理
class AppState {
    constructor() {
        this.user = null;
        this.stats = null;
        this.currentQuiz = null;
        this.quizHistory = [];
        this.listeners = new Map();
    }

    // ユーザー情報を設定
    setUser(user) {
        this.user = user;
        this.notify('user', user);
        this.saveToStorage('user', user);
    }

    // ユーザー情報を取得
    getUser() {
        if (!this.user) {
            this.user = this.loadFromStorage('user');
        }
        return this.user;
    }

    // 統計情報を設定
    setStats(stats) {
        this.stats = stats;
        this.notify('stats', stats);
        this.saveToStorage('stats', stats);
    }

    // 統計情報を取得
    getStats() {
        if (!this.stats) {
            this.stats = this.loadFromStorage('stats');
        }
        return this.stats;
    }

    // 現在のクイズを設定
    setCurrentQuiz(quiz) {
        this.currentQuiz = quiz;
        this.notify('currentQuiz', quiz);
        this.saveToStorage('currentQuiz', quiz);
    }

    // 現在のクイズを取得
    getCurrentQuiz() {
        if (!this.currentQuiz) {
            this.currentQuiz = this.loadFromStorage('currentQuiz');
        }
        return this.currentQuiz;
    }

    // 現在のクイズをクリア
    clearCurrentQuiz() {
        this.currentQuiz = null;
        this.notify('currentQuiz', null);
        this.removeFromStorage('currentQuiz');
    }

    // クイズ履歴を設定
    setQuizHistory(history) {
        this.quizHistory = history;
        this.notify('quizHistory', history);
        this.saveToStorage('quizHistory', history);
    }

    // クイズ履歴に追加
    addToQuizHistory(historyItem) {
        this.quizHistory.unshift(historyItem);
        // 最新20件まで保持
        if (this.quizHistory.length > 20) {
            this.quizHistory = this.quizHistory.slice(0, 20);
        }
        this.notify('quizHistory', this.quizHistory);
        this.saveToStorage('quizHistory', this.quizHistory);
    }

    // 状態変更の監視を登録
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        // 監視解除関数を返す
        return () => {
            const keyListeners = this.listeners.get(key);
            if (keyListeners) {
                keyListeners.delete(callback);
            }
        };
    }

    // 状態変更を通知
    notify(key, value) {
        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
            keyListeners.forEach(callback => callback(value));
        }
    }

    // ローカルストレージに保存
    saveToStorage(key, value) {
        try {
            localStorage.setItem(`aiQuiz_${key}`, JSON.stringify(value));
        } catch (error) {
            console.warn('ローカルストレージへの保存に失敗:', error);
        }
    }

    // ローカルストレージから読み込み
    loadFromStorage(key) {
        try {
            const item = localStorage.getItem(`aiQuiz_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.warn('ローカルストレージからの読み込みに失敗:', error);
            return null;
        }
    }

    // ローカルストレージから削除
    removeFromStorage(key) {
        try {
            localStorage.removeItem(`aiQuiz_${key}`);
        } catch (error) {
            console.warn('ローカルストレージからの削除に失敗:', error);
        }
    }

    // 全状態をクリア（ログアウト時）
    clearAll() {
        this.user = null;
        this.stats = null;
        this.currentQuiz = null;
        this.quizHistory = [];
        
        // ローカルストレージもクリア
        try {
            const keys = ['user', 'stats', 'currentQuiz', 'quizHistory'];
            keys.forEach(key => {
                localStorage.removeItem(`aiQuiz_${key}`);
            });
        } catch (error) {
            console.warn('ローカルストレージのクリアに失敗:', error);
        }

        // 全ての監視者に通知
        this.notify('user', null);
        this.notify('stats', null);
        this.notify('currentQuiz', null);
        this.notify('quizHistory', []);
    }

    // デバッグ用：現在の状態を表示
    debug() {
        console.log('AppState Debug:', {
            user: this.user,
            stats: this.stats,
            currentQuiz: this.currentQuiz,
            quizHistoryLength: this.quizHistory.length,
            listeners: Array.from(this.listeners.keys())
        });
    }
}

// グローバルインスタンスを作成
const appState = new AppState();

// デバッグ用にwindowオブジェクトに追加（開発時のみ）
if (typeof window !== 'undefined') {
    window.appState = appState;
}