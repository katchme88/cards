import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import GameScreen from "./src/screens/GameScreen";
import { clearSession, loadSession, saveSession } from "./src/state/sessionStorage";
import { disconnectSocket } from "./src/services/socketService";

const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      const saved = await loadSession();
      setSession(saved);
      setLoading(false);
    }

    bootstrap();
  }, []);

  async function handleLoggedIn(nextSession) {
    await saveSession(nextSession);
    setSession(nextSession);
  }

  async function logout() {
    disconnectSocket();
    await clearSession();
    setSession(null);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login">
            {() => <LoginScreen onLoggedIn={handleLoggedIn} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Home">
              {({ navigation }) => (
                <HomeScreen
                  session={session}
                  onQuickPlay={() => {
                    navigation.navigate("Game", { roomID: null, createRoom: false });
                  }}
                  onCreateRoom={() => {
                    navigation.navigate("Game", { roomID: null, createRoom: true });
                  }}
                  onJoinRoom={(roomID) => {
                    navigation.navigate("Game", { roomID, createRoom: false });
                  }}
                  onLogout={logout}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Game">
              {({ navigation, route }) => (
                <GameScreen
                  session={session}
                  gameOptions={route?.params || { roomID: null, createRoom: false }}
                  onReset={() => navigation.replace("Home")}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
