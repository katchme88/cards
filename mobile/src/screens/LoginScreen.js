import { useState } from "react";
import {
  Alert,
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { authenticate } from "../services/authService";

const LOGIN_BG = require("../../assets/img_7680.jpg");
const BG_SHIFT = Dimensions.get("window").height * 0.1;

function randomName() {
  const adj = ["Swift", "Bold", "Sly", "Lucky", "Keen", "Brave", "Cool", "Sharp"];
  const noun = ["Fox", "Ace", "King", "Hawk", "Wolf", "Bear", "Lion", "Star"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = noun[Math.floor(Math.random() * noun.length)];
  const num = Math.floor(Math.random() * 100);
  return `${a}${n}${num}`;
}

export default function LoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState(randomName());
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const name = username.trim() || randomName();

    try {
      setLoading(true);
      const data = await authenticate(name, "");
      const session = {
        username: data.username,
        playerID: data.playerID,
      };
      onLoggedIn(session);
    } catch (error) {
      const reason =
        error?.response?.data?.reason ||
        error?.message ||
        "Login failed. Check API URL and server status.";
      Alert.alert("Login failed", reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground source={LOGIN_BG} style={styles.container} imageStyle={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <View style={styles.content}>
          <Text style={styles.subtitle}>Tap Play to join</Text>

          <TextInput
            style={styles.input}
            placeholder="nickname"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />

          <Pressable
            style={({ pressed }) => [
              styles.buttonShell,
              styles.primaryShell,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonShellPressed,
            ]}
            disabled={loading}
            onPress={handleLogin}
          >
            {({ pressed }) => (
              <View style={[styles.buttonFace, styles.primaryFace, pressed && !loading && styles.buttonFacePressed]}>
                <Text style={styles.buttonText}>{loading ? "Joining..." : "Play"}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    top: -BG_SHIFT,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 16, 13, 0.34)",
  },
  keyboardWrap: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 150,
    justifyContent: "flex-end",
    gap: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#c8d9c2",
    textAlign: "center",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#f4f2e8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  buttonShell: {
    marginTop: 4,
    borderRadius: 14,
    paddingBottom: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonShellPressed: {
    paddingBottom: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonFace: {
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 2,
    borderTopColor: "rgba(255, 248, 228, 0.9)",
    borderLeftColor: "rgba(255, 238, 200, 0.85)",
    borderRightColor: "rgba(38, 24, 18, 0.5)",
    borderBottomColor: "rgba(38, 24, 18, 0.62)",
  },
  buttonFacePressed: {
    transform: [{ translateY: 2 }],
  },
  primaryShell: {
    backgroundColor: "#6b2518",
  },
  primaryFace: {
    backgroundColor: "#bb4a2b",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff9ec",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.45,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
