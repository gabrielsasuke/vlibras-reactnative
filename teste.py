import whisper
import torch
import os

try:
    model = whisper.load_model("large")
    print("Modelo carregado com sucesso.")

    caminho_do_audio = "audio_nico.ogg"

    diretorio_atual = os.getcwd()
    caminho_completo = os.path.abspath(caminho_do_audio)

    print(f"Iniciando a transcrição de '{caminho_do_audio}'...")
    
    result = model.transcribe(
        caminho_do_audio,
        language="pt",      
        verbose=True 
    )

    print("\n--- Transcrição Concluída ---")
    print(result["text"])
    print("-----------------------------\n")

except FileNotFoundError:
    print(f"Erro: O arquivo '{caminho_do_audio}' não foi encontrado no caminho esperado.")
except Exception as e:
    print(f"Ocorreu um erro inesperado: {e}")