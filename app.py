# --------------- BIBLIOTECAS ---------------
from flask import Flask, request, jsonify
from flask_cors import CORS 
import whisper
import os
import torch

# --- CONFIGURAÇÃO DA APLICAÇÃO FLASK ---
app = Flask(__name__)
CORS(app)

MODEL_SIZE = "small"  
DEVICE = "cpu"       

print(f"A carregar o modelo Whisper '{MODEL_SIZE}' no dispositivo '{DEVICE}'...")
try:
    model = whisper.load_model(MODEL_SIZE, device=DEVICE)
    print("Modelo carregado com sucesso.")
except Exception as e:
    print(f"Erro ao carregar o modelo: {e}")
    model = None

# --- ROTAS DA API ---

# ROTA PRINCIPAL (PARA TESTES DE CONEXÃO)
@app.route('/')
def index():
    return jsonify({"message": "Servidor de transcrição está no ar."})

# ROTA DE TRANSCRIÇÃO
@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if model is None:
        return jsonify({"error": "Modelo Whisper não foi carregado corretamente."}), 500

    if 'audio_data' not in request.files:
        return jsonify({"error": "Nenhum ficheiro de áudio encontrado no pedido."}), 400

    audio_file = request.files['audio_data']
    filename = "temp_recording.m4a"  
    filepath = os.path.join(os.getcwd(), filename)

    try:
        audio_file.save(filepath)
        print(f"Ficheiro de áudio salvo em: {filepath}")

        print("A iniciar a transcrição...")
        result = model.transcribe(filepath, language="pt")
        transcribed_text = result['text']
        print(f"Transcrição concluída: {transcribed_text}")

        return jsonify({"transcription": transcribed_text})

    except Exception as e:
        print(f"Ocorreu um erro durante a transcrição: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

# --- PONTO DE ENTRADA PRINCIPAL ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

