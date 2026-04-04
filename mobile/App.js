import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import GameScreen from "./src/screens/GameScreen";
import { clearSession, loadSession } from "./src/state/sessionStorage";
import { disconnectSocket } from "./src/services/socketService";

const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      await clearSession();
      setLoading(false);
    }

    bootstrap();
  }, []);

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
            {() => <LoginScreen onLoggedIn={setSession} />}
          </Stack.Screen>
        ) : (
          <>
            {/* HomeScreen disabled — go directly to Game
            <Stack.Screen name="Home">
              {({ navigation }) => (
                <HomeScreen
                  session={session}
                  onPlayWithFriends={() => navigation.navigate("Game")}
                  onLogout={logout}
                />
              )}
            </Stack.Screen>
            */}
            <Stack.Screen name="Game">
              {() => <GameScreen session={session} onReset={logout} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
