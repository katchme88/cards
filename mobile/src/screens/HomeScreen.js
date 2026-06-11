import { useState } from "react";
import { Alert, Dimensions, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const HOME_BG = require("../../assets/img_7680.jpg");
const BG_SHIFT = Dimensions.get("window").height * 0.1;

export default function HomeScreen({ session, onQuickPlay, onCreateRoom, onJoinRoom, onLogout }) {
  const [joinRoomID, setJoinRoomID] = useState("");

  function onRoomCodeChange(value) {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
    setJoinRoomID(digitsOnly);
  }

  function handleJoinRoom() {
    const nextRoomID = joinRoomID.trim();
    if (!/^\d{6}$/.test(nextRoomID)) {
      Alert.alert("Invalid room code", "Enter a valid 6-digit room code.");
      return;
    }
    onJoinRoom(nextRoomID);
    setJoinRoomID("");
  }

  return (
    <ImageBackground source={HOME_BG} style={styles.container} imageStyle={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay} />
      <View style={styles.content}>
        <View style={styles.mainActions}>
          <Text style={styles.title}>Welcome, {session.username}</Text>
          <Text style={styles.subtitle}>Choose how you want to play</Text>

          <Pressable
            style={({ pressed }) => [
              styles.buttonShell,
              styles.primaryShell,
              pressed && styles.buttonShellPressed,
            ]}
            onPress={onCreateRoom}
          >
            {({ pressed }) => (
              <View style={[styles.buttonFace, styles.primaryFace, pressed && styles.buttonFacePressed]}>
                <Text style={styles.buttonText}>Create Room</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.joinBlock}>
            <TextInput
              style={styles.input}
              placeholder="6-digit room code"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={6}
              value={joinRoomID}
              onChangeText={onRoomCodeChange}
            />
            <Pressable
              style={({ pressed }) => [
                styles.buttonShell,
                styles.secondaryShell,
                pressed && styles.buttonShellPressed,
              ]}
              onPress={handleJoinRoom}
            >
              {({ pressed }) => (
                <View style={[styles.buttonFace, styles.secondaryFace, pressed && styles.buttonFacePressed]}>
                  <Text style={styles.buttonText}>Join Room</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.buttonShell,
              styles.tertiaryShell,
              pressed && styles.buttonShellPressed,
            ]}
            onPress={onQuickPlay}
          >
            {({ pressed }) => (
              <View style={[styles.buttonFace, styles.tertiaryFace, pressed && styles.buttonFacePressed]}>
                <Text style={styles.buttonText}>Quick Play</Text>
              </View>
            )}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.buttonShell,
            styles.secondaryShell,
            styles.logoutButton,
            pressed && styles.buttonShellPressed,
          ]}
          onPress={onLogout}
        >
          {({ pressed }) => (
            <View style={[styles.buttonFace, styles.secondaryFace, pressed && styles.buttonFacePressed]}>
              <Text style={styles.buttonText}>Log Out</Text>
            </View>
          )}
        </Pressable>
      </View>
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
  content: {
    flex: 1,
    padding: 24,
  },
  mainActions: {
    flex: 1,
    justifyContent: "center",
    gap: 14,
  },
  title: {
    color: "#f8efcf",
    fontWeight: "700",
    fontSize: 28,
    marginBottom: 4,
  },
  subtitle: {
    color: "#d5e2d7",
    fontSize: 14,
    marginBottom: 10,
  },
  buttonShell: {
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
    paddingVertical: 14,
    paddingHorizontal: 12,
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
  secondaryShell: {
    backgroundColor: "#29463c",
  },
  secondaryFace: {
    backgroundColor: "#4a7164",
  },
  tertiaryShell: {
    backgroundColor: "#1f5e4e",
  },
  tertiaryFace: {
    backgroundColor: "#32846d",
  },
  logoutButton: {
    marginBottom: 8,
  },
  joinBlock: {
    gap: 8,
  },
  input: {
    backgroundColor: "#f4f2e8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8c89a",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
