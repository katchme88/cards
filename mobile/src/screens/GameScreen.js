import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { connectSocket } from "../services/socketService";
import { API_BASE_URL } from "../config/network";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const IMAGE_URL = `${API_BASE_URL}/images/cards/`;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = SCREEN_W * 0.12;
const CARD_H = CARD_W * 1.45;
const TABLE_CARD_H = SCREEN_H * 0.12;

const SUIT_IMAGES = {
  H: "HeartSuit",
  C: "ClubSuit",
  D: "DiamondSuit",
  S: "SpadeSuit",
};

const CARD_JARGONS = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
};

// Helpers -------------------------------------------------------------------
function arrangeCards(cards) {
  const buckets = { C: [], D: [], S: [], H: [] };
  cards.forEach((c) => {
    const suit = c[0];
    if (buckets[suit]) buckets[suit].push(c);
  });
  return [...buckets.C, ...buckets.D, ...buckets.S, ...buckets.H];
}

function getPlayerPerspective(sequence, username) {
  const p = [...sequence];
  const idx = p.indexOf(username);
  for (let i = 0; i < idx; i++) p.push(p.shift());
  return p; // [me, right, top, left]
}

function cardImageUri(code) {
  return { uri: `${IMAGE_URL}${code}.png` };
}

// ===========================================================================
// Component
// ===========================================================================
export default function GameScreen({ session, onReset }) {
  // ---- connection ---------------------------------------------------------
  const [socketStatus, setSocketStatus] = useState("connecting");
  const socket = useMemo(() => connectSocket(), []);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ---- players ------------------------------------------------------------
  const [playerSequence, setPlayerSequence] = useState([]);
  const [playerPerspective, setPlayerPerspective] = useState([]);
  const [playerNumber, setPlayerNumber] = useState(0);
  const [activePlayer, setActivePlayer] = useState(-1); // perspective index 0-3 with gold border

  // ---- cards --------------------------------------------------------------
  const [hand, setHand] = useState([]);
  const [tableCards, setTableCards] = useState({}); // { 1: code, 2: code, ... }
  const [selectedCard, setSelectedCard] = useState(null);

  // ---- game state ---------------------------------------------------------
  const [myTurn, setMyTurn] = useState(false);
  const [currentRoundSuit, setCurrentRoundSuit] = useState(null);
  const [suitsInHand, setSuitsInHand] = useState([]);
  const [choosingTrump, setChoosingTrump] = useState(false);
  const [trumpCard, setTrumpCard] = useState(null);
  const [trumpRevealed, setTrumpRevealed] = useState(false);
  const [trumpAsked, setTrumpAsked] = useState(false);
  const [youRequestedTrump, setYouRequestedTrump] = useState(false);
  const [moodaSuit, setMoodaSuit] = useState(null);
  const [trumpCaller, setTrumpCaller] = useState(-1); // perspective index

  // ---- scores -------------------------------------------------------------
  const [scores, setScores] = useState({
    teamAscore: 0,
    teamBscore: 0,
    teamAwins: 0,
    teamBwins: 0,
    teamAHands: 0,
    teamBHands: 0,
  });

  // ---- bets ---------------------------------------------------------------
  const [showBetModal, setShowBetModal] = useState(false);
  const [highestBet, setHighestBet] = useState(0);
  const [betBubbles, setBetBubbles] = useState({}); // { perspIdx: text }

  // ---- mooda --------------------------------------------------------------
  const [showMoodaModal, setShowMoodaModal] = useState(false);
  const [enableMoodaBtn, setEnableMoodaBtn] = useState(false);
  const [partnerCards, setPartnerCards] = useState(null); // array or null

  // ---- overlay message ----------------------------------------------------
  const [overlay, setOverlay] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const overlayTimer = useRef(null);
  const countdownTimer = useRef(null);

  // ---- refs for mutable state in callbacks --------------------------------
  const handRef = useRef(hand);
  handRef.current = hand;
  const perspectiveRef = useRef(playerPerspective);
  perspectiveRef.current = playerPerspective;
  const sequenceRef = useRef(playerSequence);
  sequenceRef.current = playerSequence;

  // ---- helpers ------------------------------------------------------------
  const showOverlay = useCallback((msg, timeout = 3000) => {
    setOverlay(msg);
    setCountdown(null);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setOverlay(null), timeout);
  }, []);

  const showOverlayWithCountdown = useCallback((msg, seconds) => {
    setCountdown(seconds);
    setOverlay(msg);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    let remaining = seconds;
    countdownTimer.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownTimer.current);
        setOverlay(null);
        setCountdown(null);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, []);

  function updateSuitsInHand(cards) {
    const s = [...new Set(cards.map((c) => c[0]))];
    setSuitsInHand(s);
    return s;
  }

  // ---- throw card ---------------------------------------------------------
  function handleThrowCard(cardCode, budRungi = false) {
    if (!socket.connected) {
      Alert.alert("Disconnected", "Trying to reconnect\u2026");
      socket.connect();
      return;
    }
    const message = budRungi ? "budRungi" : cardCode;
    socket.emit("card thrown", message);
    const next = hand.filter((c) => c !== cardCode);
    setHand(next);
    updateSuitsInHand(next);
    setTableCards((prev) => ({ ...prev, [1]: cardCode }));
    setMyTurn(false);
    setActivePlayer(-1);
    setSelectedCard(null);
    setEnableMoodaBtn(false);
  }

  function onCardPress(cardCode) {
    if (choosingTrump) {
      socket.emit("trump card", cardCode);
      const next = hand.filter((c) => c !== cardCode);
      setHand(next);
      updateSuitsInHand(next);
      setChoosingTrump(false);
      return;
    }
    if (!myTurn) {
      showOverlay("Wait for your turn");
      return;
    }
    if (selectedCard === cardCode) {
      // second tap = throw
      // validate suit
      const suits = [...new Set(handRef.current.map((c) => c[0]))];
      const hasSuit = currentRoundSuit && suits.includes(currentRoundSuit);

      if (hasSuit && cardCode[0] !== currentRoundSuit) {
        showOverlay("Throw correct suit");
        return;
      }

      // If opponent (p2/p4) has no suit and trump not revealed, prompt to request trump
      if (currentRoundSuit && !hasSuit && cardCode[0] !== currentRoundSuit
          && (playerNumber === 2 || playerNumber === 4) && !trumpRevealed) {
        showOverlay("Tap the trump card to request it");
        return;
      }

      // After requesting trump, must throw trump suit if you have it
      if (trumpRevealed && youRequestedTrump) {
        const trumpSuit = trumpCard?.[0];
        const hasTrumpSuit = trumpSuit && suits.includes(trumpSuit);
        if (hasTrumpSuit && cardCode[0] !== trumpSuit) {
          showOverlay("You have to throw trump");
          return;
        }
        setYouRequestedTrump(false);
      }

      // BudRungi: player 1 (trump caller) throws off-suit and trump not revealed
      const isBudRungi = playerNumber === 1 && !trumpRevealed && currentRoundSuit && !hasSuit;
      handleThrowCard(cardCode, isBudRungi);
    } else {
      setSelectedCard(cardCode);
    }
  }

  // ---- request / reveal trump ---------------------------------------------
  function onTrumpPress() {
    // Trump caller can reveal trump by tapping it
    if (playerNumber === 1 && trumpCard && !trumpRevealed) {
      socket.emit("reveal trump");
      // Add trump card back to hand
      const cardCode = trumpCard;
      const next = [...hand, cardCode];
      setHand(arrangeCards(next.slice().sort()));
      updateSuitsInHand(next);
      setTrumpRevealed(true);
      setTrumpCard(null);
      return;
    }
    // Opponents (p2/p4) request trump when they don't have the round suit
    if ((playerNumber === 2 || playerNumber === 4) && currentRoundSuit && !trumpRevealed) {
      const suits = [...new Set(hand.map((c) => c[0]))];
      if (!suits.includes(currentRoundSuit)) {
        socket.emit("request trump");
        setYouRequestedTrump(true);
        return;
      }
    }
    if (playerNumber === 3) {
      showOverlay("Your partner is the trump caller");
      return;
    }
  }

  // ---- bet ----------------------------------------------------------------
  function placeBet(bet) {
    socket.emit("bet", { bet, username: session.username });
    setShowBetModal(false);
  }

  // ---- mooda --------------------------------------------------------------
  function callMooda(suit) {
    socket.emit("mooda", { moodaSuit: suit });
    setShowMoodaModal(false);
    setEnableMoodaBtn(false);
  }

  // =========================================================================
  // Socket wiring
  // =========================================================================
  useEffect(() => {
    function onConnect() {
      setSocketStatus("connected");
      socket.emit("add user", {
        username: session.username,
        playerID: session.playerID,
      });
    }
    function onDisconnect(reason) {
      setSocketStatus("disconnected");
      // If server closed the connection (not a client-initiated disconnect), go to login
      if (reason === "io server disconnect" || reason === "transport close") {
        setTimeout(() => onReset?.(), 2000);
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // -- login / join -------------------------------------------------------
    socket.on("login", (data) => {
      const seq = data.playerSequence || [];
      setPlayerSequence(seq);
      setPlayerNumber(data.playerNumber);
      const persp = getPlayerPerspective(seq, session.username);
      setPlayerPerspective(persp);
      if (seq.length === 4) {
        setActivePlayer(persp.indexOf(seq[0]));
        setTrumpCaller(persp.indexOf(seq[0]));
      }
    });

    socket.on("user joined", (data) => {
      const seq = data.playerSequence || [];
      setPlayerSequence(seq);
      const persp = getPlayerPerspective(seq, session.username);
      setPlayerPerspective(persp);
      if (seq.length === 4 && !data.reConnected) {
        setActivePlayer(persp.indexOf(seq[0]));
        setTrumpCaller(persp.indexOf(seq[0]));
      }
      if (data.reConnected) showOverlay(`${data.username} is back online`);
    });

    socket.on("user left", (data) => {
      const seconds = Math.ceil((data.timeout || 30000) / 1000);
      showOverlayWithCountdown(data.message, seconds);
    });

    // -- deal ---------------------------------------------------------------
    socket.on("deal", (data) => {
      if (!data?.hand) return;
      const merged = data.redeal ? data.hand : [...handRef.current, ...data.hand];
      const sorted = arrangeCards(merged.slice().sort());
      setHand(sorted);
      updateSuitsInHand(sorted);
      setBetBubbles({});
    });

    // -- turns & cards ------------------------------------------------------
    socket.on("your turn", (data) => {
      setMyTurn(true);
      setCurrentRoundSuit(data.currentRoundSuit || null);
      setActivePlayer(0);
      if (data.totalRounds === 0 && !data.moodaCalled) setEnableMoodaBtn(true);
    });

    socket.on("card thrown", (data) => {
      const persp = perspectiveRef.current;
      const pos = persp.indexOf(data.username) + 1;
      setTableCards((prev) => ({ ...prev, [pos]: data.message }));
      setActivePlayer(pos < 4 ? pos : 0);
    });

    socket.on("senior player", (data) => {
      const persp = perspectiveRef.current;
      setTimeout(() => {
        setTableCards({});
        setActivePlayer(persp.indexOf(data.username));
      }, 1500);
    });

    socket.on("hands picked", (data) => {
      setScores((s) => ({ ...s, teamAHands: data.teamAHands, teamBHands: data.teamBHands }));
      showOverlay(`${data.username}'s team picked ${data.handsPicked} hands`);
      setTimeout(() => setTableCards({}), 1500);
    });

    socket.on("winner announcement", (data) => {
      showOverlay(data.message, 5000);
      setScores({
        teamAscore: data.teamAscore,
        teamBscore: data.teamBscore,
        teamAwins: data.teamAwins,
        teamBwins: data.teamBwins,
        teamAHands: data.teamAHands ?? 0,
        teamBHands: data.teamBHands ?? 0,
      });
    });

    // -- trump --------------------------------------------------------------
    socket.on("choose trump", () => {
      setChoosingTrump(true);
      showOverlay("Tap a card to choose the trump");
    });

    socket.on("trump card", (data) => {
      setTrumpCard(data.data);
      setMoodaSuit(null);
    });

    socket.on("trump setted", () => {
      showOverlay("Trump has been chosen");
      setTrumpCard("budRungi");
    });

    socket.on("request trump", (data) => {
      setTrumpAsked(true);
      showOverlay(`${data.username} opened the trump`);
    });

    socket.on("reveal trump", (data) => {
      setTrumpRevealed(true);
      setTrumpCard(data.trumpCard);
    });

    // -- bets ---------------------------------------------------------------
    socket.on("choose bet", (data) => {
      setHighestBet(data.highestBet || 0);
      setShowBetModal(true);
    });

    socket.on("bet", (data) => {
      const persp = perspectiveRef.current;
      const pos = persp.indexOf(data.username);
      setBetBubbles((prev) => ({ ...prev, [pos]: data.bet }));
    });

    // -- mooda --------------------------------------------------------------
    socket.on("mooda", (data) => {
      setMyTurn(false);
      setTrumpRevealed(true);
      setTrumpCard(null);
      setMoodaSuit(data.moodaSuit);
      const persp = perspectiveRef.current;
      const pos = persp.indexOf(data.username);
      setBetBubbles({ [pos]: "Mooda" });
      if (!data.reConnected) setTimeout(() => setTableCards({}), 1500);
    });

    socket.on("share cards", (data) => {
      setPartnerCards(arrangeCards(data.partnerCards.slice().sort()));
    });

    socket.on("accepted", (data) => {
      const persp = perspectiveRef.current;
      const pos = persp.indexOf(data.username);
      setBetBubbles((prev) => ({ ...prev, [pos]: "Accepted" }));
      setPartnerCards(null);
    });

    socket.on("rejected", (data) => {
      const persp = perspectiveRef.current;
      const pos = persp.indexOf(data.username);
      setBetBubbles((prev) => ({ ...prev, [pos]: "Rejected" }));
      setPartnerCards(null);
    });

    // -- redeal / new sequence ----------------------------------------------
    socket.on("redeal", (data) => {
      const seq = data.playerSequence || [];
      setPlayerSequence(seq);
      const persp = getPlayerPerspective(seq, session.username);
      setPlayerPerspective(persp);
      setPlayerNumber(seq.indexOf(session.username) + 1);
      setTrumpCaller(persp.indexOf(seq[0]));
      setActivePlayer(persp.indexOf(seq[0]));
      setHand([]);
      setTableCards({});
      setTrumpCard(null);
      setTrumpRevealed(false);
      setTrumpAsked(false);
      setYouRequestedTrump(false);
      setMoodaSuit(null);
      setChoosingTrump(false);
      setMyTurn(false);
      setBetBubbles({});
      setSelectedCard(null);
      setScores((s) => ({ ...s, teamAHands: 0, teamBHands: 0 }));
    });

    socket.on("new sequence", (data) => {
      const seq = data.playerSequence || [];
      setPlayerSequence(seq);
      const persp = getPlayerPerspective(seq, session.username);
      setPlayerPerspective(persp);
      setPlayerNumber(seq.indexOf(session.username) + 1);
      setTrumpCaller(persp.indexOf(seq[0]));
      setActivePlayer(persp.indexOf(seq[0]));
    });

    // -- misc ---------------------------------------------------------------
    socket.on("room full", () => {
      Alert.alert("Room full", "A game is in progress.");
      setTimeout(() => onReset?.(), 2000);
    });
    socket.on("reset", () => {
      showOverlay("Game will reset\u2026");
      setTimeout(() => onReset?.(), 3000);
    });
    socket.on("disable ui", () => setMyTurn(false));
    socket.on("enable ui", () => {});
    socket.on("message", (data) => {
      showOverlay(`${data.username}: ${data.message}`, 4000);
    });

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      [
        "login","user joined","user left","deal","your turn","card thrown",
        "senior player","hands picked","winner announcement","choose trump",
        "trump card","trump setted","request trump","reveal trump",
        "choose bet","bet","mooda","share cards","accepted","rejected",
        "redeal","new sequence","room full","reset","disable ui","enable ui",
        "message","reconnect","reconnect_error",
      ].forEach((e) => socket.removeAllListeners(e));
    };
  }, [session.playerID, session.username, socket, showOverlay, showOverlayWithCountdown]);

  // ---- pulse animation for my turn ----------------------------------------
  useEffect(() => {
    if (myTurn) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [myTurn, pulseAnim]);

  // =========================================================================
  // Derived
  // =========================================================================
  const p = playerPerspective; // [me(bottom), right, top, left]
  const teamANames = p.length >= 3 ? `${p[0] || "?"} & ${p[2] || "?"}` : "Team A";
  const teamBNames = p.length >= 4 ? `${p[1] || "?"} & ${p[3] || "?"}` : "Team B";

  // =========================================================================
  // Render helpers
  // =========================================================================
  function renderAvatar(perspIdx, style) {
    const name = p[perspIdx] || "";
    const isActive = activePlayer === perspIdx;
    const isTrumpCaller = trumpCaller === perspIdx;
    const isMe = perspIdx === 0;
    const circle = (
      <View
        style={[
          styles.avatarCircle,
          isActive && styles.avatarActive,
          isTrumpCaller && styles.avatarTrumpCaller,
        ]}
      >
        <Text style={styles.avatarInitial}>
          {name ? name[0].toUpperCase() : "?"}
        </Text>
      </View>
    );
    return (
      <View style={[styles.avatarWrap, style]}>
        {isMe && myTurn ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            {circle}
          </Animated.View>
        ) : (
          circle
        )}
        <Text style={styles.avatarName} numberOfLines={1}>{name}</Text>
        {betBubbles[perspIdx] != null && (
          <View style={styles.betBubble}>
            <Text style={styles.betBubbleText}>{String(betBubbles[perspIdx])}</Text>
          </View>
        )}
      </View>
    );
  }

  function renderTableCard(perspIdx) {
    const code = tableCards[perspIdx];
    if (!code) return null;
    return (
      <Image
        source={cardImageUri(code)}
        style={[
          styles.tableCardImg,
          (perspIdx === 2 || perspIdx === 4) && { transform: [{ rotate: "90deg" }] },
        ]}
        resizeMode="contain"
      />
    );
  }

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* ---- Status bar ---- */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, socketStatus === "connected" ? styles.dotGreen : styles.dotRed]} />
        <Text style={styles.statusText}>{session.username}</Text>
      </View>

      {/* ---- Score Card ---- */}
      <View style={styles.scoreCard}>
        <View style={[styles.scoreRow, styles.scoreHeaderRow]}>
          <Text style={[styles.scoreCell, styles.scoreHeader, { flex: 2 }]}>Team</Text>
          <Text style={[styles.scoreCell, styles.scoreHeader]}>Sc</Text>
          <Text style={[styles.scoreCell, styles.scoreHeader]}>W</Text>
          <Text style={[styles.scoreCell, styles.scoreHeader]}>Tr</Text>
        </View>
        <View style={[styles.scoreRow, styles.teamARow]}>
          <Text style={[styles.scoreCell, { flex: 2 }]} numberOfLines={1}>{teamANames}</Text>
          <Text style={styles.scoreCell}>{scores.teamAscore}</Text>
          <Text style={styles.scoreCell}>{scores.teamAwins}</Text>
          <Text style={styles.scoreCell}>{scores.teamAHands}</Text>
        </View>
        <View style={[styles.scoreRow, styles.teamBRow]}>
          <Text style={[styles.scoreCell, { flex: 2 }]} numberOfLines={1}>{teamBNames}</Text>
          <Text style={styles.scoreCell}>{scores.teamBscore}</Text>
          <Text style={styles.scoreCell}>{scores.teamBwins}</Text>
          <Text style={styles.scoreCell}>{scores.teamBHands}</Text>
        </View>
      </View>

      {/* ---- TABLE AREA ---- */}
      <View style={styles.tableArea}>
        {/* Top player (perspective index 2) */}
        <View style={styles.topSection}>
          {renderAvatar(2, styles.topAvatar)}
        </View>

        {/* Center row: left player, table, right player */}
        <View style={styles.centerSection}>
          {/* Left player (perspective index 3) */}
          <View style={styles.sidePlayer}>
            {renderAvatar(3)}
          </View>

          {/* Table center */}
          <View style={styles.tableCenterWrap}>
            <View style={styles.tableCenter}>
              {/* Thrown cards in 4 positions */}
              <View style={styles.tableCardPos3}>{renderTableCard(3)}</View>
              <View style={styles.tableCardPos1}>{renderTableCard(1)}</View>
              <View style={styles.tableCardPos4}>{renderTableCard(4)}</View>
              <View style={styles.tableCardPos2}>{renderTableCard(2)}</View>
            </View>
          </View>

          {/* Right player (perspective index 1) */}
          <View style={styles.sidePlayer}>
            {renderAvatar(1)}
          </View>
        </View>

        {/* Bottom player (me, perspective index 0) */}
        <View style={styles.bottomAvatarRow}>
          {/* Left spacer for symmetry */}
          <View style={styles.bottomSide}>
            {enableMoodaBtn && (
              <Pressable style={styles.moodaBtn} onPress={() => setShowMoodaModal(true)}>
                <Image source={{ uri: `${IMAGE_URL}M.png` }} style={styles.moodaImg} resizeMode="contain" />
              </Pressable>
            )}
          </View>
          {renderAvatar(0, styles.bottomAvatar)}
          {/* Trump / Mooda indicators on the right */}
          <View style={styles.bottomSide}>
            {(trumpCard || moodaSuit) && (
              <Pressable style={styles.trumpBadge} onPress={onTrumpPress}>
                {trumpCard && (
                  <Image source={cardImageUri(trumpCard)} style={styles.trumpImg} resizeMode="contain" />
                )}
                {moodaSuit && (
                  <Image source={{ uri: `${IMAGE_URL}${SUIT_IMAGES[moodaSuit]}.jpg` }} style={styles.trumpImg} resizeMode="contain" />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* ---- HAND (fan) ---- */}
      {myTurn && (
        <View style={styles.yourTurnBanner}>
          <Text style={styles.yourTurnText}>YOUR TURN</Text>
        </View>
      )}
      <View style={styles.handArea}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.handScroll}
        >
          {hand.length === 0 ? (
            <Text style={styles.waitText}>Waiting for deal…</Text>
          ) : (
            hand.map((card, idx) => {
              const isSelected = selectedCard === card;
              const totalCards = hand.length;
              const mid = (totalCards - 1) / 2;
              const angle = (idx - mid) * (24 / Math.max(totalCards - 1, 1));
              return (
                <Pressable
                  key={`${card}-${idx}`}
                  onPress={() => onCardPress(card)}
                  style={[
                    styles.handCardWrap,
                    {
                      marginRight: -CARD_W * 0.45,
                      transform: [
                        { rotate: `${angle}deg` },
                        { translateY: isSelected ? -16 : 0 },
                      ],
                      zIndex: idx,
                    },
                  ]}
                >
                  <Image source={cardImageUri(card)} style={styles.handCardImg} resizeMode="contain" />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ---- Overlay message ---- */}
      {overlay && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayBox}>
            <Text style={styles.overlayText}>{overlay}</Text>
            {countdown != null && (
              <Text style={styles.countdownText}>{countdown}s</Text>
            )}
          </View>
        </View>
      )}

      {/* ---- Bet Modal ---- */}
      <Modal visible={showBetModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Place Your Bet</Text>
            <Text style={styles.modalSub}>Highest bet: {highestBet}</Text>
            <View style={styles.betGrid}>
              {[8, 9, 10, 11, 12, 13].map((n) => (
                <Pressable
                  key={n}
                  style={[styles.betBtn, n <= highestBet && styles.betBtnDisabled]}
                  onPress={() => {
                    if (n > highestBet) placeBet(n);
                    else showOverlay(`Current highest bet is ${highestBet}`);
                  }}
                >
                  <Text style={styles.betBtnText}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.passBtn} onPress={() => placeBet("pass")}>
              <Text style={styles.passBtnText}>Pass</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---- Mooda Suit Modal ---- */}
      <Modal visible={showMoodaModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Choose Mooda Suit</Text>
            <View style={styles.moodaGrid}>
              {["H", "C", "D", "S"].map((s) => (
                <Pressable key={s} style={styles.moodaSuitBtn} onPress={() => callMooda(s)}>
                  <Image
                    source={{ uri: `${IMAGE_URL}${SUIT_IMAGES[s]}.jpg` }}
                    style={styles.moodaSuitImg}
                    resizeMode="contain"
                  />
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.passBtn} onPress={() => setShowMoodaModal(false)}>
              <Text style={styles.passBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---- Partner Cards Modal ---- */}
      <Modal visible={!!partnerCards} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Partner's Cards</Text>
            <ScrollView horizontal contentContainerStyle={styles.partnerScroll}>
              {(partnerCards || []).map((c, i) => (
                <Image key={`${c}-${i}`} source={cardImageUri(c)} style={styles.partnerCard} resizeMode="contain" />
              ))}
            </ScrollView>
            <View style={styles.partnerBtns}>
              <Pressable
                style={[styles.betBtn, { backgroundColor: "#2d8544" }]}
                onPress={() => { socket.emit("accepted"); setPartnerCards(null); }}
              >
                <Text style={styles.betBtnText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.betBtn, { backgroundColor: "#a63232" }]}
                onPress={() => { socket.emit("rejected"); setPartnerCards(null); }}
              >
                <Text style={styles.betBtnText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ===========================================================================
// Styles
// ===========================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1e18" },

  // -- status bar --
  statusBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 4, gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: "#4caf50" },
  dotRed: { backgroundColor: "#f44336" },
  statusText: { color: "#c3d0c8", fontSize: 12 },

  // -- score card --
  scoreCard: {
    marginHorizontal: 10, marginTop: 4, borderRadius: 8, overflow: "hidden",
    borderWidth: 1, borderColor: "#3a5248",
  },
  scoreRow: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6 },
  scoreHeaderRow: { backgroundColor: "#1a302a" },
  teamARow: { backgroundColor: "#3b3522" },
  teamBRow: { backgroundColor: "#1c2a40" },
  scoreHeader: { fontWeight: "700" },
  scoreCell: { flex: 1, color: "#f8efcf", fontSize: 11, textAlign: "center" },

  // -- table area --
  tableArea: { flex: 1, paddingHorizontal: 6 },

  topSection: { alignItems: "center", paddingTop: 2 },
  topAvatar: {},

  centerSection: { flex: 1, flexDirection: "row", alignItems: "center" },
  sidePlayer: { width: 64, alignItems: "center" },

  tableCenterWrap: { flex: 1, padding: 4 },
  tableCenter: {
    flex: 1, backgroundColor: "#1a4a32", borderRadius: 16,
    borderWidth: 2, borderColor: "#ddd",
    justifyContent: "center", alignItems: "center",
    position: "relative",
  },

  // table card positions (absolute within tableCenter)
  tableCardPos3: { position: "absolute", top: 6, alignSelf: "center" },
  tableCardPos1: { position: "absolute", bottom: 6, alignSelf: "center" },
  tableCardPos4: { position: "absolute", left: 6, top: "30%" },
  tableCardPos2: { position: "absolute", right: 6, top: "30%" },
  tableCardImg: { width: TABLE_CARD_H * 0.7, height: TABLE_CARD_H },

  // trump badge
  trumpBadge: { flexDirection: "row", gap: 4 },
  trumpImg: { width: 45, height: 63 },

  // bottom row
  bottomAvatarRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingBottom: 2,
  },
  bottomSide: { flex: 1, alignItems: "flex-end", justifyContent: "center", paddingRight: 12 },
  bottomAvatar: {},

  // -- avatars --
  avatarWrap: { alignItems: "center", width: 58 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#264d3b", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#58796a",
  },
  avatarActive: { borderColor: "gold", borderWidth: 3 },
  avatarTrumpCaller: { backgroundColor: "#8b2020" },
  avatarInitial: { color: "#f8efcf", fontSize: 18, fontWeight: "700" },
  avatarName: { color: "#f8efcf", fontSize: 10, marginTop: 2, textAlign: "center" },

  // -- bet bubbles --
  betBubble: {
    backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    marginTop: 2,
  },
  betBubbleText: { color: "#ff4444", fontSize: 10, fontWeight: "700" },

  // -- hand --
  handArea: {
    height: CARD_H + 24, paddingBottom: 6,
  },
  handScroll: {
    alignItems: "flex-end", paddingHorizontal: SCREEN_W * 0.04,
  },
  handCardWrap: { width: CARD_W },
  handCardImg: {
    width: CARD_W, height: CARD_H,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
  },
  waitText: { color: "#c3d0c8", fontSize: 14, alignSelf: "center", paddingTop: 20 },

  // -- your turn banner --
  yourTurnBanner: {
    alignItems: "center", paddingVertical: 4,
  },
  yourTurnText: {
    color: "gold", fontSize: 14, fontWeight: "800", letterSpacing: 2,
  },

  // -- mooda button --
  moodaBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#264d3b",
    justifyContent: "center", alignItems: "center",
  },
  moodaImg: { width: 30, height: 30 },

  // -- overlay --
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
  },
  overlayBox: {
    backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 14, maxWidth: "80%",
  },
  overlayText: { color: "#f8efcf", fontSize: 16, textAlign: "center", fontWeight: "600" },
  countdownText: { color: "#ff9944", fontSize: 28, fontWeight: "700", marginTop: 8 },

  // -- modals --
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#1a302a", borderRadius: 16, padding: 20,
    width: "85%", alignItems: "center",
    borderWidth: 1, borderColor: "#3a5248",
  },
  modalTitle: { color: "#f8efcf", fontSize: 20, fontWeight: "700", marginBottom: 6 },
  modalSub: { color: "#c3d0c8", fontSize: 13, marginBottom: 14 },

  betGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 12,
  },
  betBtn: {
    backgroundColor: "#c84f2f", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20,
    minWidth: 60, alignItems: "center",
  },
  betBtnDisabled: { backgroundColor: "#555" },
  betBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  passBtn: {
    backgroundColor: "#3a5248", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 30,
  },
  passBtnText: { color: "#f8efcf", fontSize: 15, fontWeight: "600" },

  // -- mooda grid --
  moodaGrid: { flexDirection: "row", gap: 14, marginBottom: 16 },
  moodaSuitBtn: {
    width: 60, height: 60, borderRadius: 12, backgroundColor: "#264d3b",
    justifyContent: "center", alignItems: "center",
  },
  moodaSuitImg: { width: 40, height: 40 },

  // -- partner cards --
  partnerScroll: { paddingVertical: 10, gap: 6, paddingHorizontal: 8 },
  partnerCard: { width: CARD_W * 0.9, height: CARD_H * 0.9 },
  partnerBtns: { flexDirection: "row", gap: 14, marginTop: 10 },
});
