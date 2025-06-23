# --------------- BIBLIOTECAS ---------------
import tkinter as tk
from tkinter import ttk, scrolledtext
import threading      # PARA NÃO TRAVAR INTERFACE
import queue          # COMUNICAR ENTRE THREADS
import os             # INTERAGIR COM SO
import whisper        # TRANSCRIÇÃO DA OPENAI
import torch          # USADO PELO WHISPER
import sounddevice as sd # GRAVAR E REPRODUZIR O ÁUDIO
from scipy.io.wavfile import write # SALVAR ÁUDIO EM FORMATO .WAV
import numpy as np    # USA PRA MANIPULAR O ÁUDIO

# https://www.youtube.com/playlist?list=PLqx8fDb-FZDFznZcXb_u_NyiQ7Nai674- (AULAS DE TKINTER)
# https://www.youtube.com/watch?v=AiBC01p58oI (AULA DE TKINTER)
# https://www.youtube.com/playlist?list=PL5TJqBvpXQv6pHlMrbC-NfgeGE2CGrd1S (AULAS DE THREADS)
# https://www.youtube.com/watch?v=b1ErnwAsJx4 (AULAS DE GRAVAÇÃO DE ÁUDIO)

# --- CLASSE DA APLICAÇÃO ---
class App:
    def __init__(self, root):
        # --- CONFIG JANELA PRINCIPAL ---
        self.root = root
        self.root.geometry("500x400") # JANELA = LARGURA X ALTURW

        self.queue = queue.Queue() # THREAD PRA NÃO TRAVAR

        # --- COMPONENTES) ---
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True) # PREENCHER JANELA

        duration_frame = ttk.Frame(main_frame)
        duration_frame.pack(fill=tk.X, pady=5) # PREENCHE HORIZONTAL E VERTICAL

        self.label_duration = ttk.Label(duration_frame, text="Duração (segundos):")
        self.label_duration.pack(side=tk.LEFT, padx=(0, 10)) # Alinha à esquerda com margem

        # SELECIONAR SEGUNDOS
        self.spin_duration = ttk.Spinbox(duration_frame, from_=1, to=60, width=5)
        self.spin_duration.set(5) # VALOR INICIAL DE 5 SEGUNDOS
        self.spin_duration.pack(side=tk.LEFT)

        # BOTÃO DE CLICK
        self.button = ttk.Button(main_frame, text="Gravar e Transcrever", command=self.start_process_thread)
        self.button.pack(fill=tk.X, pady=5)

        # ÁREA DE STATUS E TRANSCRIÇÃO
        self.text_area = scrolledtext.ScrolledText(main_frame, wrap=tk.WORD, height=10)
        self.text_area.pack(fill=tk.BOTH, expand=True, pady=5)
        self.text_area.configure(state='disabled') # Começa desabilitada para o usuário não poder editar

        # VERIFICA MENSAGEM DA THREAD
        self.root.after(100, self.process_queue)

    def start_process_thread(self):
        """
        Esta função é chamada quando o botão é clicado.
        Ela prepara e inicia a thread de trabalho em segundo plano.
        """
        # DESABILITAR BOTÃO PRA NÃO TENTAR TRANSCREVER
        self.button.config(state='disabled')
        
        # INSERIR NOVAS MENSAGENS
        self.text_area.config(state='normal')
        self.text_area.delete('1.0', tk.END) # LIMPA TEXTO

        # DURAÇÃO ESCOLHIDA PELO USUÁRIO
        duration = int(self.spin_duration.get())
        
        # CRIA A THREAD
        self.thread = threading.Thread(
            target=self.worker_function, 
            args=(duration, self.queue)
        )
        # INICIA THREAD
        self.thread.start()

    def process_queue(self):
        # THREAD PRA ATUALIZAR A GUI
        try:
            # PEGA MENSAGEM NA FILA (ESPERO QUE SEM TRAVAR)
            message_type, data = self.queue.get_nowait()

            # PROCESSA MENSAGEM NO TIPO
            if message_type == "progress":
                self.text_area.insert(tk.END, data + "\n")
            elif message_type == "error":
                self.text_area.insert(tk.END, f"\nERRO:\n{data}\n")
                self.button.config(state='normal') # BOTÃO FUNCIONA CASO ERRO
            elif message_type == "finished":
                self.text_area.insert(tk.END, "\n--- TRANSCRIÇÃO FINAL ---\n")
                self.text_area.insert(tk.END, data)
                self.button.config(state='normal') # BOTÃO FUNCIONA CASO FUNCIONE
            
            # MOSTRA ÚLTIMA MENSAGEM
            self.text_area.see(tk.END)

        except queue.Empty:
            # FILA VAZIA
            pass
        finally:
            # LOOP DE VERIFICAÇÃO
            self.root.after(100, self.process_queue)

    def worker_function(self, duration, q):
        # COISAS DE GRAVAÇÃO
        audio_filename = "gravacao_temporaria.wav" # ARQUIVO DE SAÍDA
        model_size = "large" # MODELO

        # --- DEFINIÇÃO MANUAL DO MICROFONE ---
        MICROPHONE_ID = 5 
        
        try:
            # --- CORREÇÃO DA SAMPLE RATE  ---
            # CONSULTA O MICROFONE PRA VER QUAL OS HERTZ DELE
            device_info = sd.query_devices(device=MICROPHONE_ID, kind='input')
            sample_rate = int(device_info['default_samplerate'])
            q.put(("progress", f"Usando Dispositivo ID {MICROPHONE_ID} com taxa de {sample_rate} Hz."))
            
            # GRAVA ÁUDIO
            q.put(("progress", f"Iniciando gravação de {duration} segundos..."))
            recording = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='int16', device=MICROPHONE_ID)
            sd.wait() # PAUSA A THREAD DE TRABALHO ATÉ TERMINAR DE GRAVAR

            q.put(("progress", "Gravação concluída. Salvando arquivo..."))
            write(audio_filename, sample_rate, recording)

            # MODELO RODA NA CPU, NÃO NA GPU PORQUE NÃO TEM CUDA
            device = "cpu"
            q.put(("progress", f"Carregando modelo '{model_size}' no dispositivo '{device}'..."))
            
            model = whisper.load_model(model_size, device=device)
            
            q.put(("progress", "Modelo carregado. Transcrevendo áudio..."))
            
            # TRANSCREVE O ÁUDIO
            result = model.transcribe(audio_filename, language="pt")
            transcribed_text = result['text']
            
            # VÊ SE A TRANSCRIÇÃO PEGOU ALGO
            if not transcribed_text.strip():
                transcribed_text = "(Nenhum texto foi detectado no áudio)"
            
            # RESULTADO NA FILA
            q.put(("finished", transcribed_text))

        except Exception as e:
            # EM CASO DE ERRO, MANDA MENSAGEM DE ERRO NA FILA
            q.put(("error", str(e)))
        finally:
            # GARANTE QUE O ARQUIVO DELETE DEPOIS
            if os.path.exists(audio_filename):
                os.remove(audio_filename)

# MAIN
if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
