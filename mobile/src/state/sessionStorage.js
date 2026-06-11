import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SESSION_KEY = "cards_session";
const canUseWebSessionStorage =
  Platform.OS === "web" && typeof window !== "undefined" && !!window.sessionStorage;

export async function saveSession(session) {
  const serialized = JSON.stringify(session);
  if (canUseWebSessionStorage) {
    window.sessionStorage.setItem(SESSION_KEY, serialized);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, serialized);
}

export async function loadSession() {
  const raw = canUseWebSessionStorage
    ? window.sessionStorage.getItem(SESSION_KEY)
    : await AsyncStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearSession() {
  if (canUseWebSessionStorage) {
    window.sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  await AsyncStorage.removeItem(SESSION_KEY);
}
