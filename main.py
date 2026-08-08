import os
import json
import re
# Flask: Pythonで簡単にWebアプリ（ホームページやAPI）を作るためのフレームワーク
from flask import Flask, request, jsonify, render_template, send_from_directory
# Werkzeug: アップロードされたファイル名を安全な名前に変換するユーティリティ
from werkzeug.utils import secure_filename
# google.genai: Google公式の最新のGemini API用ライブラリ
from google import genai
from google.genai import types
# Pillow (PIL): 画像をPythonプログラム内で開いたり処理したりするためのライブラリ
from PIL import Image
# dotenv: 「.env」ファイルから設定情報を読み込むためのライブラリ
from dotenv import load_dotenv
# uuid: ファイル名の一意な識別子を生成するためのライブラリ
import uuid

# 「.env」ファイルに書かれた設定情報（APIキーなど）を読み込みます
load_dotenv()

# Flaskアプリケーションの本体を初期化します
app = Flask(__name__)

# アップロードされた画像を保存するフォルダのパスを設定します（このプログラムと同じ場所の「uploads」フォルダ）
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
# 保存フォルダが存在しない場合は自動で作成します
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# アップロードできる最大ファイルサイズを16MBに制限します
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# 許可する画像の拡張子（ファイル形式）を定義します
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

def allowed_file(filename):
    """
    ファイル名が許可された拡張子（png, jpgなど）で終わっているかをチェックする関数
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_api_key(request):
    """
    APIキーを取得する関数。以下の優先順位でチェックします：
    1. 画面から送られてきたカスタムヘッダー（X-Gemini-API-Key）
    2. サーバー内の環境変数（.env またはシステム環境変数の GEMINI_API_KEY）
    """
    # 1. ブラウザから送られたヘッダーをチェック
    api_key = request.headers.get('X-Gemini-API-Key')
    if api_key and api_key.strip():
        return api_key.strip()
    
    # 2. サーバー側の環境変数をチェック
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key and api_key.strip():
        return api_key.strip()
        
    return None

def get_model_name(request):
    """
    使用するAIモデルの名前をブラウザからのヘッダー（X-Gemini-Model）から取得する関数。
    設定されていない場合は、標準の「gemini-3.5-flash」をデフォルトとして返します。
    """
    model_name = request.headers.get('X-Gemini-Model')
    if model_name and model_name.strip():
        return model_name.strip()
    return 'gemini-3.5-flash'

def clean_json_string(text):
    """
    Geminiからの回答テキストから、JSONオブジェクト（波括弧 { } で囲まれた部分）だけを
    抜き出す関数。AIが説明文などを前後に付けてしまった場合の対策です。
    """
    # { から始まり } で終わる部分を正規表現で探します
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    return text

@app.route('/')
def index():
    """
    アプリのトップページにアクセスされたときに動く関数。
    templates/index.html 画面を表示（レンダリング）します。
    """
    has_server_key = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    return render_template('index.html', has_server_key=has_server_key)

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    response = send_from_directory('static', 'sw.js')
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    return response

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """
    アップロードされた画像をブラウザ上で表示するための関数。
    uploadsフォルダ内の指定されたファイルをブラウザに送信します。
    """
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/analyze', methods=['POST'])
def analyze_image():
    """
    画像をAIで解析するメインのAPI処理。
    ブラウザから画像ファイルを受け取り、Gemini APIを呼び出してカロリーや栄養素をJSONで返します。
    """
    # 1. APIキーの取得とチェック
    api_key = get_api_key(request)
    if not api_key:
        return jsonify({
            'error': 'APIキーが設定されていません。環境変数「GEMINI_API_KEY」を設定するか、設定メニューからAPIキーを入力してください。'
        }), 400

    # 2. 画像ファイルが正しく送られてきているかのバリデーション（検証）
    if 'image' not in request.files:
        return jsonify({'error': '画像ファイルが見つかりません。'}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'ファイルが選択されていません。'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'error': '許可されていないファイル形式です。PNG, JPG, JPEG, WEBP, GIF のいずれかを使用してください。'}), 400

    raw_text = ""  # エラーハンドリング用にAIの生の応答テキストを初期化します
    try:
        # 画像ファイル名を安全な名前に変換します
        filename = secure_filename(file.filename)
        # ファイル名の重複を防ぐため、UUID（ランダムなユニークID）を先頭に付与します
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        # サーバー上に画像を一時保存します
        file.save(file_path)

        # 3. Gemini API クライアントの作成
        client = genai.Client(api_key=api_key)
        # 使用するモデル名（gemini-3.5-flashなど）を取得
        model_name = get_model_name(request)
        
        # AIに対する指示文（プロンプト）。JSON形式で出力するように構造を厳密に指示します。
        prompt = """料理の写真を分析し、以下の項目を特定して日本語のJSON形式で出力してください。

{
  "dish_name": "料理名（例: カツカレー、マルゲリータピザなど）",
  "calories": 650, // おおよその総カロリー（数値のみ、単位kcalは除く）
  "protein": 24.5, // たんぱく質（数値のみ、単位gは除く）
  "fat": 18.2, // 脂質（数値のみ、単位gは除く）
  "carbs": 85.0, // 炭水化物（数値のみ、単位gは除く）
  "ingredients": [
    {"name": "主な食材名（例: 豚肉、じゃがいもなど）", "amount": "目安量や重さ（例: 80g, 1/2個など）"}
  ],
  "advice": "この料理の栄養的な特徴や、より健康的に食べるための具体的なアドバイス（例: 「サラダをプラスすると食物繊維が補えます」「脂質が多めなので次の食事は控えめに」など、200文字程度）"
}

※余計な説明文や挨拶は含めず、純粋なJSONオブジェクトのみを返してください。"""

        # 保存した画像をPillowライブラリで開きます
        img = Image.open(file_path)
        
        # Gemini APIを呼び出してコンテンツを生成（解析）します
        response = client.models.generate_content(
            model=model_name,
            contents=[img, prompt],
            # JSON形式での応答を強制する設定
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        # AIからの回答を取り出します
        raw_text = response.text
        # テキストから余計な部分をそぎ落とし、純粋なJSON文字列にします
        cleaned_text = clean_json_string(raw_text)
        # JSON文字列をPythonの「辞書（dict）オブジェクト」に変換（パース）します
        data = json.loads(cleaned_text)
        
        # 画面に画像を表示できるように、保存した画像のURLをデータに追加します
        data['image_url'] = f"/uploads/{unique_filename}"
        
        # 辞書データをJSON形式のレスポンスとしてブラウザに返します（成功）
        return jsonify(data)

    except json.JSONDecodeError as je:
        # AIが正しいJSONを返さなかった場合の例外処理
        print(f"JSON Decode Error: {str(je)}")
        print(f"Raw Text was: {raw_text}")
        return jsonify({
            'error': 'AIの応答を解析できませんでした。',
            'raw_response': raw_text
        }), 500
    except Exception as e:
        # その他の想定外のエラー処理
        print(f"General Error: {str(e)}")
        return jsonify({'error': f'エラーが発生しました: {str(e)}'}), 500

@app.route('/chat', methods=['POST'])
def chat():
    """
    AI管理栄養士との相談チャットを処理するAPI。
    ユーザーからの質問と会話の履歴を受け取り、Geminiに文脈を理解させた上で回答を生成します。
    """
    # 1. APIキーのチェック
    api_key = get_api_key(request)
    if not api_key:
        return jsonify({'error': 'APIキーが設定されていません。'}), 400
        
    # 送られてきたデータ（JSON）を取り出します
    data = request.json
    if not data:
        return jsonify({'error': '無効なリクエストです。'}), 400
        
    question = data.get('question')
    dish_name = data.get('dish_name', 'この料理')
    history = data.get('history', []) # これまでの会話履歴
    
    if not question:
        return jsonify({'error': '質問が空です。'}), 400

    try:
        client = genai.Client(api_key=api_key)
        model_name = get_model_name(request)
        
        # AIに「キャラクター（前提）」を与えるためのシステム命令文です。
        system_instruction = f"あなたはプロの管理栄養士およびパーソナルトレーナーです。ユーザーがアップロードした「{dish_name}」について、栄養面やダイエット、健康管理の視点からユーザーの質問に親身に回答してください。簡潔で分かりやすい日本語を使用してください。"
        
        # これまでの履歴をテキストとして連結し、AIに文脈（対話の流れ）を理解させます
        prompt_parts = [system_instruction, "\n--- 会話の履歴 ---"]
        for msg in history:
            role_label = "ユーザー" if msg['role'] == 'user' else "AI"
            prompt_parts.append(f"{role_label}: {msg['content']}")
        
        # ユーザーが今回入力した新しい質問を追加します
        prompt_parts.append(f"\nユーザーの新しい質問: {question}")
        prompt_parts.append("AIの回答:")
        
        # すべてを1つの大きな指示文として合体させます
        full_prompt = "\n".join(prompt_parts)
        
        # Geminiに指示を送り、回答を生成してもらいます
        response = client.models.generate_content(
            model=model_name,
            contents=full_prompt
        )
        
        # 生成されたテキスト回答をJSONで返します
        return jsonify({'response': response.text})
        
    except Exception as e:
        print(f"Chat Error: {str(e)}")
        return jsonify({'error': f'チャットエラーが発生しました: {str(e)}'}), 500

# このスクリプトが直接実行された場合のみ、Flaskのローカル開発用サーバーを起動します
if __name__ == '__main__':
    # デバッグモードをオンにし、ポート5000番で実行します
    app.run(debug=True, port=5000)
