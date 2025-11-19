import React, { useState } from "react";
import { StyleSheet, Text, View, Button, Linking } from "react-native";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

const BACKEND_URL = "https://luxchatgpt.onrender.com/transcribe";
const TRANSLATOR_WEB_PAGE_URL =
  "https://gabrielsasuke.github.io/tradutor_libras/tradutor_web.html";

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcribedText, setTranscribedText] = useState("");

  // --------------------------
  // 🎤 Iniciar gravação
  // --------------------------
  const startRecording = async () => {
    try {
      console.log("Solicitando permissões...");
      await Audio.requestPermissionsAsync();

      console.log("Iniciando gravação...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      console.log("Gravação iniciada");
    } catch (err) {
      console.error("Erro ao iniciar gravação:", err);
    }
  };

  // --------------------------
  // ⏹ Parar gravação
  // --------------------------
  const stopRecording = async () => {
    console.log("Parando gravação...");
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    console.log("Áudio salvo em:", uri);

    setRecording(null);

    transcribeAudio(uri);
  };

  // --------------------------
  // 📤 Enviar áudio para transcrição
  // --------------------------
  const transcribeAudio = async (uri) => {
    try {
      const fileBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: fileBase64 })
      });

      const data = await response.json();
      console.log("Transcrição recebida:", data);

      if (data.text) {
        setTranscribedText(data.text);
        openTranslatorPage(data.text);
      }
    } catch (err) {
      console.error("Erro ao transcrever áudio:", err);
    }
  };

  // --------------------------
  // 🌐 Abrir o tradutor com texto automático
  // --------------------------
  const openTranslatorPage = (textToTranslate) => {
    const encodedText = encodeURIComponent(textToTranslate);
    const url = `${TRANSLATOR_WEB_PAGE_URL}?texto=${encodedText}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tradutor Automático para Libras</Text>

      <Button
        title={recording ? "Parar Gravação" : "Iniciar Gravação"}
        onPress={recording ? stopRecording : startRecording}
      />

      <Text style={styles.label}>Transcrição:</Text>
      <Text style={styles.output}>{transcribedText || "(vazio)"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222",
    padding: 20,
    justifyContent: "center"
  },
  header: {
    fontSize: 22,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center"
  },
  label: {
    marginTop: 30,
    fontSize: 18,
    color: "#aaa"
  },
  output: {
    marginTop: 10,
    fontSize: 16,
    color: "#fff"
  }
});
