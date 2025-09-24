import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TextInput, Platform, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Audio } from 'expo-av';

const SERVER_IP = 'https://veridical-unbecomingly-adriel.ngrok-free.dev'; 

export default function App() {
  const [recording, setRecording] = useState(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [status, setStatus] = useState('Clique no botão para começar...');
  const [duration, setDuration] = useState('5');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (permissionResponse && permissionResponse.status !== 'granted') {
      console.log('Requesting permission..');
      requestPermission();
    }
  }, [permissionResponse]);

  async function testConnection() {
    Alert.alert("Teste de Conexão", `A tentar ligar a: ${SERVER_IP}`);
    let responseText = '';
    try {
      const response = await fetch(SERVER_IP, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Mozilla/5.0',
        },
      });

      responseText = await response.text();
      
      const result = JSON.parse(responseText);
      
      if (response.ok) {
        Alert.alert("Sucesso!", `Conectado com sucesso ao servidor. Mensagem: "${result.message}"`);
      } else {
        Alert.alert("Erro do Servidor", `O servidor respondeu com um erro: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      if (error instanceof SyntaxError) {
        Alert.alert(
          "Falha na Análise de JSON", 
          `O servidor respondeu com HTML em vez de JSON. Verifique a consola do Metro para ver o conteúdo.`
        );
        console.log("Resposta recebida (HTML):", responseText);
      } else {
        Alert.alert("Falha na Conexão", `O pedido de rede falhou. Erro: ${error.message}.`);
      }
    }
  }


  async function startRecording() {
    try {
      if (permissionResponse.status !== 'granted') {
        setStatus('Permissão para usar o microfone não concedida.');
        await requestPermission();
        return;
      }

      setIsLoading(true);
      setStatus(`A preparar para gravar por ${duration} segundos...`);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
         Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setStatus(`A gravar...`);

      setTimeout(() => {
        stopRecording(recording);
      }, parseInt(duration, 10) * 1000);

    } catch (err) {
      console.error('Failed to start recording', err);
      setStatus(`Erro ao iniciar gravação: ${err.message}`);
      setIsLoading(false);
    }
  }

  async function stopRecording(rec) {
    const recToStop = rec || recording;
    if (!recToStop) return;
    
    console.log('Stopping recording..');
    setStatus('Gravação concluída. A preparar para envio...');
    await recToStop.stopAndUnloadAsync();
    
    const uri = recToStop.getURI(); 
    console.log('Recording stopped and stored at', uri);
    
    uploadAudio(uri);
  }

    async function uploadAudio(uri) {
    setStatus('A enviar áudio para o servidor...');
    const serverUrl = `${SERVER_IP}/transcribe`;

    try {
      const formData = new FormData();

      formData.append('audio_data', {
        uri: uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });
      
      const serverResponse = await fetch(serverUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'Mozilla/5.0',
          },
      });

      // Processa a resposta do servidor.
      const result = await serverResponse.json();

      if (serverResponse.ok) {
        setStatus(`--- TRANSCRIÇÃO FINAL ---\n\n${result.transcription}`);
      } else {
        setStatus(`ERRO NO SERVIDOR: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error uploading audio', error);
      setStatus(`Erro ao enviar áudio. Verifique se o servidor Flask e o ngrok estão a ser executados. Erro: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gravador e Transcritor</Text>
      
      <View style={{ marginBottom: 10, width: '100%' }}>
        <Button
          title="Testar Conexão com Servidor"
          onPress={testConnection}
          color="#841584"
        />
      </View>
      
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

      {isLoading && <ActivityIndicator size="large" color="#0000ff" style={{ marginVertical: 20 }} />}
      
      <ScrollView style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  },
  statusContainer: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#fff',
    width: '100%',
    minHeight: 120,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
});

