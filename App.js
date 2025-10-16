import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Button, TextInput, Platform, 
  ActivityIndicator, ScrollView, Alert, TouchableOpacity,
  KeyboardAvoidingView, Linking
} from 'react-native';
import { Audio } from 'expo-av';

const SERVER_IP = 'https://veridical-unbecomingly-adriel.ngrok-free.dev';

const TRANSLATOR_WEB_PAGE_URL = 'https://gabrielsasuke.github.io/tcc/tradutor_web.html';

export default function App() {
  const [mode, setMode] = useState('transcribe');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Pronto para começar.');

  // Estados da Transcrição
  const [recording, setRecording] = useState(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [duration, setDuration] = useState('5');
  const [textToCompare, setTextToCompare] = useState('');
  const [transcriptionResult, setTranscriptionResult] = useState('');

  // Estados da Tradução
  const [textToTranslate, setTextToTranslate] = useState('');
  
  useEffect(() => {
    if (permissionResponse && permissionResponse.status !== 'granted') {
      requestPermission();
    }
  }, [permissionResponse]);

  const normalizeText = (text) => {
    if (!text) return '';
    return text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  };

  async function startRecording() {
    try {
      if (permissionResponse.status !== 'granted') {
        setStatus('Permissão para usar o microfone não concedida.');
        await requestPermission();
        return;
      }
      setIsLoading(true);
      setTranscriptionResult('');
      setStatus(`A preparar para gravar por ${duration} segundos...`);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setStatus(`A gravar...`);
      setTimeout(() => stopRecording(recording), parseInt(duration, 10) * 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
      setStatus(`Erro ao iniciar gravação: ${err.message}`);
      setIsLoading(false);
    }
  }

  async function stopRecording(rec) {
    const recToStop = rec || recording;
    if (!recToStop) return;
    setStatus('Gravação concluída. A preparar para envio...');
    await recToStop.stopAndUnloadAsync();
    const uri = recToStop.getURI(); 
    uploadAudio(uri);
  }

  async function uploadAudio(uri) {
    setStatus('A enviar áudio para o servidor...');
    const serverUrl = `${SERVER_IP}/transcribe`;
    try {
      const formData = new FormData();
      formData.append('audio_data', { uri, type: 'audio/m4a', name: 'recording.m4a' });
      const serverResponse = await fetch(serverUrl, {
          method: 'POST',
          body: formData,
          headers: { 'ngrok-skip-browser-warning': 'true', 'User-Agent': 'Mozilla/5.0' },
      });
      const result = await serverResponse.json();
      if (serverResponse.ok) {
        const transcribedText = result.transcription || "(Nenhum texto detectado)";
        setTranscriptionResult(transcribedText);
        setTextToTranslate(transcribedText);

        if (textToCompare.trim() === '') {
          setStatus('Transcrição concluída com sucesso.');
        } else {
          const normalizedTranscription = normalizeText(transcribedText);
          const normalizedComparisonText = normalizeText(textToCompare);
          if (normalizedTranscription === normalizedComparisonText) {
            setStatus('✅ TEXTO CORRETO!');
          } else {
            setStatus('❌ TEXTO INCORRETO.');
          }
        }
      } else {
        setStatus(`ERRO NO SERVIDOR: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      setStatus(`Erro ao enviar áudio: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  // --- LÓGICA FINAL: Abrir o tradutor externo na nossa própria página ---
  async function handleTranslateToLibras() {
    if (!textToTranslate.trim()) {
      Alert.alert("Texto Vazio", "Por favor, insira um texto para traduzir.");
      return;
    }

    // Codifica o texto para ser seguro para uma URL
    const encodedText = encodeURIComponent(textToTranslate);
    // Constrói a URL para a nossa página, passando o texto como um parâmetro
    const url = `${TRANSLATOR_WEB_PAGE_URL}?texto=${encodedText}`;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      setStatus("A abrir o tradutor no navegador...");
      await Linking.openURL(url);
    } else {
      Alert.alert("Erro", `Não é possível abrir este link: ${url}`);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'transcribe' && styles.modeButtonActive]}
          onPress={() => setMode('transcribe')}
        >
          <Text style={[styles.modeButtonText, mode === 'transcribe' && styles.modeButtonTextActive]}>
            Áudio para Texto
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'translate' && styles.modeButtonActive]}
          onPress={() => setMode('translate')}
        >
          <Text style={[styles.modeButtonText, mode === 'translate' && styles.modeButtonTextActive]}>
            Texto para Libras
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {mode === 'transcribe' ? (
          <View style={styles.contentView}>
            <TextInput
              style={styles.textInputForCompare}
              value={textToCompare}
              onChangeText={setTextToCompare}
              placeholder="Digite a frase a ser falada (opcional)"
              editable={!isLoading}
            />
            <View style={styles.controls}>
              <Text style={styles.label}>Duração (s):</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                editable={!isLoading}
              />
            </View>
            <Button
              title={isLoading ? "A gravar..." : "Gravar e Transcrever"}
              onPress={startRecording}
              disabled={isLoading}
            />
            {transcriptionResult ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>Resultado da Transcrição:</Text>
                <Text style={styles.resultText}>{transcriptionResult}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.contentView}>
            <TextInput
              style={styles.textInputForTranslate}
              value={textToTranslate}
              onChangeText={setTextToTranslate}
              placeholder="Digite ou cole o texto para traduzir"
              multiline
              editable={!isLoading}
            />
            <Button
              title={isLoading ? "A preparar..." : "Traduzir (Abrir no Navegador)"}
              onPress={handleTranslateToLibras}
              disabled={isLoading}
            />
          </View>
        )}
      </View>

      <View style={styles.statusContainer}>
        {isLoading ? <ActivityIndicator size="small" color="#0000ff" /> : <View style={{height: 20}}/>}
        <ScrollView>
          <Text style={styles.statusText}>{status}</Text>
        </ScrollView>
      </View>
      
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
    width: '100%',
  },
  contentView: {
    width: '100%',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  label: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textInputForCompare: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textInputForTranslate: {
    width: '100%',
    height: 150,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    textAlignVertical: 'top',
    fontSize: 16,
    backgroundColor: '#fff',
  },
  resultBox: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#fff',
    width: '100%',
  },
  resultTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 16,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
  },
  statusContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#f8f8f8',
    width: '100%',
    height: 80,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

