// HTMLの読み込みが完了した時点で実行されるイベントリスナー
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. HTML要素（DOM）の取得 ---
    // 画面上の様々なボタンや入力欄などの要素をJavaScriptで操作できるように取得します。
    const dropZone = document.getElementById('drop-zone'); // 画像ドロップエリア
    const imageInput = document.getElementById('image-input'); // 非表示のファイル選択入力
    const previewContainer = document.getElementById('preview-container'); // 画像プレビュー用コンテナ
    const imagePreview = document.getElementById('image-preview'); // プレビュー画像タグ本体
    const btnRemoveImage = document.getElementById('btn-remove-image'); // 画像削除ボタン
    const btnDiagnose = document.getElementById('btn-diagnose'); // 「診断する」ボタン
    
    const welcomePanel = document.getElementById('welcome-panel'); // 初期歓迎パネル
    const loadingPanel = document.getElementById('loading-panel'); // 解析中ローディングパネル
    const loadingMessage = document.getElementById('loading-message'); // ローディング中のメッセージテキスト
    const resultsPanel = document.getElementById('results-panel'); // 結果表示コンテナ全体
    
    // 設定関連の要素
    const btnConfig = document.getElementById('btn-config'); // 「APIキー設定」ボタン
    const configModal = document.getElementById('config-modal'); // 設定モーダル（ポップアップ窓）
    const btnCloseModal = document.getElementById('btn-close-modal'); // モーダル閉じるボタン
    const apiKeyInput = document.getElementById('api-key-input'); // APIキー入力欄
    const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility'); // APIキーの目玉アイコン（非表示切り替え）
    const btnDeleteKey = document.getElementById('btn-delete-key'); // キー削除ボタン
    const btnSaveKey = document.getElementById('btn-save-key'); // キー保存ボタン
    const apiReminder = document.getElementById('api-reminder'); // APIキー未設定の注意帯
    const modelSelect = document.getElementById('model-select'); // AIモデルのセレクトボックス

    // 結果表示用の要素
    const resultDishName = document.getElementById('result-dish-name'); // 料理名
    const resultCalories = document.getElementById('result-calories'); // カロリー数値
    const calorieProgressRing = document.getElementById('calorie-progress-ring'); // 円形メーターの線
    const resultProtein = document.getElementById('result-protein'); // たんぱく質数値
    const resultFat = document.getElementById('result-fat'); // 脂質数値
    const resultCarbs = document.getElementById('result-carbs'); // 炭水化物数値
    const barProtein = document.getElementById('bar-protein'); // たんぱく質メーターバー
    const barFat = document.getElementById('bar-fat'); // 脂質メーターバー
    const barCarbs = document.getElementById('bar-carbs'); // 炭水化物メーターバー
    const resultIngredientsBody = document.getElementById('result-ingredients-body'); // 食材テーブルの本体
    const resultAdvice = document.getElementById('result-advice'); // 管理栄養士のアドバイス欄

    // チャット関連の要素
    const chatMessages = document.getElementById('chat-messages'); // チャットメッセージ履歴エリア
    const chatInput = document.getElementById('chat-input'); // チャットテキスト入力欄
    const btnSendChat = document.getElementById('btn-send-chat'); // チャット送信ボタン
    const btnClearChat = document.getElementById('btn-clear-chat'); // チャットクリアボタン

    // --- 2. 状態管理（ステート）用の変数 ---
    let currentImageFile = null; // 現在選択されている画像ファイルオブジェクト
    let currentDishName = '';    // 解析された料理の名前
    let chatHistory = [];        // チャットの対話履歴（過去のやり取り）を記憶する配列
    
    // --- 3. APIキーとモデル情報の保存と管理（LocalStorage） ---
    // ブラウザのメモリ（LocalStorage）を使って、キーやモデルを保存・取得します。
    function getStoredApiKey() {
        return localStorage.getItem('gemini_api_key') || '';
    }

    function setStoredApiKey(key) {
        localStorage.setItem('gemini_api_key', key);
    }

    function removeStoredApiKey() {
        localStorage.removeItem('gemini_api_key');
    }

    function getStoredModel() {
        return localStorage.getItem('gemini_model') || 'gemini-3.5-flash';
    }

    function setStoredModel(model) {
        localStorage.setItem('gemini_model', model);
    }

    // 初期化：保存されているAPIキーとモデルを設定画面に反映させます
    apiKeyInput.value = getStoredApiKey();
    modelSelect.value = getStoredModel();
    checkApiKeyStatus();

    function checkApiKeyStatus() {
        // サーバー側のAPIキーを使用するため、警告帯は常に非表示にします
        if (apiReminder) {
            apiReminder.classList.add('hidden');
            apiReminder.style.display = 'none';
        }
    }

    // --- 4. モーダル画面（設定ポップアップ）のイベント制御 ---
    // APIキー設定ボタンまたは注意帯をクリックしたとき
    function openConfigModal() {
        apiKeyInput.value = getStoredApiKey();
        modelSelect.value = getStoredModel();
        configModal.classList.remove('hidden'); // モーダルを表示
    }

    btnConfig.addEventListener('click', openConfigModal);
    if (apiReminder) {
        apiReminder.style.cursor = 'pointer';
        apiReminder.addEventListener('click', openConfigModal);
    }


    // 設定画面の「×」ボタンをクリックしたとき
    btnCloseModal.addEventListener('click', () => {
        configModal.classList.add('hidden'); // モーダルを隠す
    });

    // 設定画面の外側（暗い背景部分）をクリックしたときに画面を閉じる処理
    configModal.addEventListener('click', (e) => {
        if (e.target === configModal) {
            configModal.classList.add('hidden');
        }
    });

    // APIキーの表示・非表示（パスワードマスク）を切り替える目玉ボタンの処理
    btnToggleKeyVisibility.addEventListener('click', () => {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        const icon = btnToggleKeyVisibility.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });

    // 「保存する」ボタンを押したとき
    btnSaveKey.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            setStoredApiKey(key);
        } else {
            removeStoredApiKey();
        }
        setStoredModel(modelSelect.value); // モデルの選択状態を保存
        checkApiKeyStatus();
        configModal.classList.add('hidden');
    });

    // 「キーを削除」ボタンを押したとき
    btnDeleteKey.addEventListener('click', () => {
        removeStoredApiKey();
        apiKeyInput.value = '';
        checkApiKeyStatus();
        configModal.classList.add('hidden');
    });

    // --- 5. ドラッグ＆ドロップおよびファイル選択の制御 ---
    // ドラッグ中にエリアが光る（クラス付与）処理
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    // ドラッグが外れた、またはドロップされたときに光る効果を消す処理
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    // 画像がエリアにドロップされた時の処理
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            handleSelectedFile(files[0]);
        }
    });

    // 「ファイルを選択」ボタンからファイルが選ばれた時の処理
    imageInput.addEventListener('change', (e) => {
        if (imageInput.files.length) {
            handleSelectedFile(imageInput.files[0]);
        }
    });

    // 選択された画像をプレビュー表示する関数
    function handleSelectedFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください。');
            return;
        }
        currentImageFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            previewContainer.classList.remove('hidden'); // プレビュー画像を表示
            
            // 「診断する」ボタンを有効化する
            btnDiagnose.classList.remove('btn-disabled');
            btnDiagnose.removeAttribute('disabled');
        };
        reader.readAsDataURL(file);
    }

    // プレビュー右上の「×」ボタンを押して画像を解除する時の処理
    btnRemoveImage.addEventListener('click', (e) => {
        e.stopPropagation(); // 親要素のファイルダイアログ起動を防ぐ
        currentImageFile = null;
        imagePreview.src = '';
        previewContainer.classList.add('hidden');
        imageInput.value = '';
        
        // 「診断する」ボタンを無効化する
        btnDiagnose.classList.add('btn-disabled');
        btnDiagnose.setAttribute('disabled', true);
    });

    // ドロップエリア内の「ファイルを選択」ボタンが押されたとき、非表示の input[type="file"] を代理でクリックさせる
    const btnBrowse = dropZone.querySelector('.btn-browse');
    btnBrowse.addEventListener('click', (e) => {
        e.stopPropagation();
        imageInput.click();
    });

    // --- 6. AI画像診断処理（Flaskへのリクエスト） ---
    // ローディング中に順次切り替わるメッセージリスト
    const loadingMessages = [
        "AIが画像を解析中...",
        "料理を識別しています...",
        "食材と分量を推定中...",
        "栄養素とカロリーを算出しています...",
        "管理栄養士のアドバイスを生成中..."
    ];

    // 「診断する」ボタンを押したときの処理
    btnDiagnose.addEventListener('click', () => {
        if (!currentImageFile) return;

        // 画面をローディング表示に切り替えます
        welcomePanel.classList.add('hidden');
        resultsPanel.classList.add('hidden');
        loadingPanel.classList.remove('hidden');
        
        // ローディング中の進捗メッセージを2秒ごとに切り替えるタイマー
        let messageIndex = 0;
        loadingMessage.textContent = loadingMessages[messageIndex];
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            loadingMessage.textContent = loadingMessages[messageIndex];
        }, 2000);

        // ファイルをアップロードするための入れ物（FormData）を作ります
        const formData = new FormData();
        formData.append('image', currentImageFile);

        // 通信用ヘッダーにAPIキーと選択中のモデルを設定します
        const headers = {};
        const key = getStoredApiKey();
        if (key) {
            headers['X-Gemini-API-Key'] = key;
        }
        headers['X-Gemini-Model'] = getStoredModel();

        // バックエンドの /analyze エンドポイントに画像データを送信（POSTリクエスト）
        fetch('/analyze', {
            method: 'POST',
            headers: headers,
            body: formData
        })
        .then(response => {
            // 通信エラー時、サーバーから返されたエラー文を取り出して例外を発生させます
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'サーバーエラーが発生しました。'); });
            }
            return response.json(); // 返ってきたデータをJSONとして受け取ります
        })
        .then(data => {
            clearInterval(messageInterval); // メッセージ切り替えタイマーを停止
            loadingPanel.classList.add('hidden'); // ローディング表示を隠す
            renderResults(data); // 結果を画面に表示する
        })
        .catch(err => {
            clearInterval(messageInterval);
            loadingPanel.classList.add('hidden');
            welcomePanel.classList.remove('hidden');
            alert(err.message); // エラーメッセージをアラート表示
        });
    });

    // --- 7. 結果画面の描画とアニメーション制御 ---
    function renderResults(data) {
        currentDishName = data.dish_name;
        
        // 料理名の表示更新
        resultDishName.textContent = data.dish_name;
        
        // カロリーメーターの数値を0から診断結果までカウントアップする演出
        animateNumber(resultCalories, 0, Math.round(data.calories), 1000);
        
        // 円形メーターの進捗割合を計算（例：1000kcalを100%の基準として円を満たす）
        const calPercent = Math.min((data.calories / 1000) * 100, 100);
        updateCalorieRing(calPercent);

        // 三大栄養素（PFC）の数値を小数第一位付きでカウントアップ
        animateNumberFloat(resultProtein, 0, data.protein, 1000);
        animateNumberFloat(resultFat, 0, data.fat, 1000);
        animateNumberFloat(resultCarbs, 0, data.carbs, 1000);

        // 栄養素の進捗バーを伸ばすアニメーション（目標目安：P:50g, F:50g, C:150g を最大値として計算）
        setTimeout(() => {
            barProtein.style.width = `${Math.min((data.protein / 50) * 100, 100)}%`;
            barFat.style.width = `${Math.min((data.fat / 50) * 100, 100)}%`;
            barCarbs.style.width = `${Math.min((data.carbs / 150) * 100, 100)}%`;
        }, 100);

        // 推定食材リスト（テーブル）の中身を組み立て
        resultIngredientsBody.innerHTML = '';
        data.ingredients.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.amount}</td>
            `;
            resultIngredientsBody.appendChild(tr);
        });

        // AI栄養士のアドバイス文章を流し込む
        resultAdvice.textContent = data.advice;

        // 結果パネルを表示し、その位置まで画面をスムーズにスクロールさせます
        resultsPanel.classList.remove('hidden');
        resultsPanel.scrollIntoView({ behavior: 'smooth' });

        // チャット画面を現在の料理名に合わせて初期化
        resetChat();
    }

    // 円形プログレスメーター（SVG）の線の長さを割合（%）に応じて書き換える関数
    function updateCalorieRing(percent) {
        const radius = 50; // 円の半径
        const circumference = 2 * Math.PI * radius; // 円周の長さ (約314)
        const offset = circumference - (percent / 100) * circumference; // 進捗に応じた余白
        
        // 破線（strokeDasharray）と位置オフセットを設定してアニメーションを実現します
        calorieProgressRing.style.strokeDasharray = circumference;
        calorieProgressRing.style.strokeDashoffset = offset;
    }

    // 整数のカウントアップを行う関数（startからendまで徐々に数値を増やす）
    function animateNumber(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.textContent = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = end;
            }
        };
        window.requestAnimationFrame(step);
    }

    // 小数点（Float）のカウントアップを行う関数（栄養素g表示用）
    function animateNumberFloat(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.textContent = (progress * (end - start) + start).toFixed(1);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                element.textContent = end.toFixed(1);
            }
        };
        window.requestAnimationFrame(step);
    }

    // --- 8. AI管理栄養士チャットボットの対話ロジック ---
    // チャット画面の初期メッセージ
    function resetChat() {
        chatHistory = [];
        chatMessages.innerHTML = `
            <div class="chat-message bot">
                この「${currentDishName}」のカロリーや栄養バランスについて、気になることはありますか？<br>
                「糖質を減らす工夫は？」「代わりに使えるヘルシーな食材は？」など、何でも聞いてくださいね。
            </div>
        `;
    }

    // 新しいメッセージふきだしをチャットエリアに追加する関数
    function addChatMessage(message, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`; // ロール（user または bot）に応じたスタイルをあてる
        messageDiv.innerHTML = message.replace(/\n/g, '<br>'); // 改行コードをHTMLの改行タグに変換
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // 常に最新のメッセージが見えるよう最下部にスクロール
    }

    // メッセージ送信処理
    function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // ユーザーの入力内容を画面に追加
        addChatMessage(text, 'user');
        chatInput.value = '';

        // 会話履歴配列に追加
        chatHistory.push({ role: 'user', content: text });

        // AIが考え中であることを示す吹き出し（3つの点々アニメーション）を作成して表示
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chat-message bot typing';
        loadingDiv.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // API通信設定
        const key = getStoredApiKey();
        const headers = { 'Content-Type': 'application/json' };
        if (key) {
            headers['X-Gemini-API-Key'] = key;
        }
        headers['X-Gemini-Model'] = getStoredModel();

        // /chat エンドポイントに会話履歴と質問を送信
        fetch('/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                question: text,
                dish_name: currentDishName,
                history: chatHistory
            })
        })
        .then(response => {
            loadingDiv.remove(); // 考え中吹き出しを削除
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'チャットでエラーが発生しました。'); });
            }
            return response.json();
        })
        .then(data => {
            // AIからの回答を画面に吹き出しとして追加
            addChatMessage(data.response, 'bot');
            // 回答を会話履歴に追加
            chatHistory.push({ role: 'model', content: data.response });
        })
        .catch(err => {
            loadingDiv.remove();
            // エラー時のシステムメッセージふきだしを表示
            const errDiv = document.createElement('div');
            errDiv.className = 'chat-message system-error';
            errDiv.textContent = err.message;
            chatMessages.appendChild(errDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    // 送信ボタンがクリックされたとき
    btnSendChat.addEventListener('click', sendChatMessage);

    // テキスト入力欄でEnterキーが押されたとき（送信処理実行）
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // クリアボタンが押されたとき
    btnClearChat.addEventListener('click', () => {
        if (confirm('チャットの会話履歴をクリアしますか？')) {
            resetChat();
        }
    });

    // --- 7. PWA Service Worker 登録 & インストールプロンプト処理 ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('ServiceWorker registered with scope:', registration.scope);
                })
                .catch((error) => {
                    console.log('ServiceWorker registration failed:', error);
                });
        });
    }

    let deferredPrompt = null;
    const btnPwaInstall = document.getElementById('btn-pwa-install');

    window.addEventListener('beforeinstallprompt', (e) => {
        // ブラウザの標準プロンプトを一旦抑止し、カスタムUIボタンを表示
        e.preventDefault();
        deferredPrompt = e;
        if (btnPwaInstall) {
            btnPwaInstall.classList.remove('hidden');
        }
    });

    if (btnPwaInstall) {
        btnPwaInstall.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User choice outcome: ${outcome}`);
            deferredPrompt = null;
            btnPwaInstall.classList.add('hidden');
        });
    }

    window.addEventListener('appinstalled', () => {
        console.log('NutriVision PWA installed successfully!');
        if (btnPwaInstall) {
            btnPwaInstall.classList.add('hidden');
        }
    });
});

