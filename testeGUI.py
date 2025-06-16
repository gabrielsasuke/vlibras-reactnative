import tkinter as tk
from tkinter import ttk, scrolledtext
import threading
import queue
import os
import whisper
import torch
import sounddevice as sd
from scipy.io.wavfile import write
import numpy as np

class App:
    def __init__(self, root):
        self.root = root
        self.root.geometry("500x400")
        self.queue = queue.Queue()
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        duration_frame = ttk.Frame(main_frame)
        duration_frame.pack(fill=tk.X, pady=5)
        self.label_duration = ttk.Label(duration_frame, text="Duração (segundos):")
        self.label_duration.pack(side=tk.LEFT, padx=(0, 10))
        self.spin_duration = ttk.Spinbox(duration_frame, from_=1, to=60, width=5)
        self.spin_duration.set(5)
        self.spin_duration.pack(side=tk.LEFT)
        self.button = ttk.Button(main_frame, text="Gravar", command=self.start_process_thread)
        self.button.pack(fill=tk.X, pady=5)
        self.text_area = scrolledtext.ScrolledText(main_frame, wrap=tk.WORD, height=10)
        self.text_area.pack(fill=tk.BOTH, expand=True, pady=5)
        self.text_area.configure(state='disabled')
        self.root.after(100, self.process_queue)

    def start_process_thread(self):
        """Inicia a thread de trabalho para não bloquear a GUI."""
        self.button.config(state='disabled')
        self.text_area.config(state='normal')
        self.text_area.delete('1.0', tk.END)
        duration = int(self.spin_duration.get())
        self.thread = threading.Thread(
            target=self.worker_function, 
            args=(duration, self.queue)
        )
        self.thread.start()

    def process_queue(self):
        try:
            message_type, data = self.queue.get_nowait()
            if message_type == "progress":
                self.text_area.insert(tk.END, data + "\n")
            elif message_type == "error":
                self.text_area.insert(tk.END, f"\nERRO:\n{data}\n")
                self.button.config(state='normal')
            elif message_type == "finished":
                self.text_area.insert(tk.END, "\n--- TRANSCRIÇÃO FINAL ---\n")
                self.text_area.insert(tk.END, data)
                self.button.config(state='normal')
            
            self.text_area.see(tk.END)

        except queue.Empty:
            pass
        finally:
            self.root.after(100, self.process_queue)

    def worker_function(self, duration, q):
        audio_filename = "grava_temp.wav"
        sample_rate = 44100
        model_size = "large" 

        try:
            q.put(("progress", f"Iniciando gravação..."))
            recording = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='int16', device=5)
            sd.wait()
            q.put(("progress", "Salvando arquivo..."))
            write(audio_filename, sample_rate, recording)
            device = "cpu"
            model = whisper.load_model(model_size, device=device)
            q.put(("progress", "Transcrevendo áudio..."))
            result = model.transcribe(audio_filename, language="pt")
            transcribed_text = result['text']
            if not transcribed_text.strip():
                transcribed_text = "(Nenhum texto foi detectado no áudio)"
            q.put(("finished", transcribed_text))

        except Exception as e:
            q.put(("error", str(e)))
        finally:
            if os.path.exists(audio_filename):
                os.remove(audio_filename)

if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()