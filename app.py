# --------------- BIBLIOTECAS ---------------
from flask import Flask, render_template, request, jsonify
import os
import whisper
import torch
import numpy as np

#Inicializa a aplicação Flask
app = Flask(__name__)

#Modelo carrega 1x
DEVICE = "cpu"
MODEL_SIZE = "small" #Modelo Whisper

print(f"Carregando o modelo Whisper '{MODEL_SIZE}' no dispositivo '{DEVICE}'.")
#Carrega o modelo na memória
model = whisper.load_model(MODEL_SIZE, device=DEVICE)
print("Modelo carregado com sucesso.")


# --- ROTAS DA APLICAÇÃO ---

@app.route('/')
def index():
    """
    Rota que renderiza a interface web (o arquivo index.html)
    """
    #O Flask procura automaticamente por este arquivo na pasta 'templates'
    return render_template('index.html')


@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Rota que recebe o áudio gravado pelo navegador, processa com o Whisper
    e retorna a transcrição
    """
    #Verifica se um arquivo de áudio foi enviado na requisição
    if 'audio_data' not in request.files:
        return jsonify({'error': 'Nenhum arquivo de áudio encontrado'}), 400

    audio_file = request.files['audio_data']
    
    #Nome de arquivo temporário para salvar o áudio recebido
    temp_filename = "temp_recording.wav"
    
    try:
        #Salva o arquivo de áudio no disco
        audio_file.save(temp_filename)

        print("Arquivo de áudio recebido. Transcrevendo...")

        #Executa a transcrição usando o modelo já carregado
        result = model.transcribe(temp_filename, language="pt")
        transcribed_text = result['text']

        print(f"Transcrição: {transcribed_text}")

        #Retorna o texto transrito em formato JSON para o frontend
        return jsonify({'transcription': transcribed_text})

    except Exception as e:
        #Em caso de erro, retorna uma mensagem de erro
        return jsonify({'error': str(e)}), 500
    finally:
        #Garante que o arquivo temporário seja sempre deletado, mesmo se ocorrer um erro
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


# --- PONTO DE ENTRADA DO PROGRAMA ---
if __name__ == "__main__":
    # Inicia o servidor Flask em modo de depuração
    # Acesse http://127.0.0.1:5000 no seu navegador
    app.run(debug=True)
