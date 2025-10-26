
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_SIZE = Math.min((SCREEN_WIDTH - 80) / 9, 40);

// Mahjong tile types
type TileSuit = 'bamboo' | 'character' | 'dot' | 'wind' | 'dragon' | 'flower';
type TileValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type WindValue = 'east' | 'south' | 'west' | 'north';
type DragonValue = 'red' | 'green' | 'white';

interface Tile {
  id: string;
  suit: TileSuit;
  value?: TileValue | WindValue | DragonValue;
  isSelected?: boolean;
}

type Difficulty = 'easy' | 'medium' | 'hard';

interface Player {
  id: string;
  name: string;
  hand: Tile[];
  discarded: Tile[];
  isAI: boolean;
}

// Separate component for animated tiles
interface AnimatedTileProps {
  tile: Tile;
  isSelected: boolean;
  isPlayerHand: boolean;
  tileColor: string;
  tileDisplay: string;
  onPress: () => void;
  themeColors: any;
}

function AnimatedTile({ 
  tile, 
  isSelected, 
  isPlayerHand, 
  tileColor, 
  tileDisplay, 
  onPress,
  themeColors 
}: AnimatedTileProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.1 : 1) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!isPlayerHand}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: tileColor,
            borderColor: isSelected ? themeColors.primary : 'transparent',
            borderWidth: isSelected ? 3 : 1,
          },
          animatedStyle,
        ]}
      >
        <Text style={styles.tileText}>{tileDisplay}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function MahjongScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();
  const difficulty = (params.difficulty as Difficulty) || 'medium';

  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [drawPile, setDrawPile] = useState<Tile[]>([]);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [lastDrawnTile, setLastDrawnTile] = useState<Tile | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  const createTileDeck = (): Tile[] => {
    const tiles: Tile[] = [];
    let idCounter = 0;

    // Create numbered tiles (4 of each)
    const suits: TileSuit[] = ['bamboo', 'character', 'dot'];
    suits.forEach(suit => {
      for (let value = 1; value <= 9; value++) {
        for (let copy = 0; copy < 4; copy++) {
          tiles.push({
            id: `${suit}-${value}-${idCounter++}`,
            suit,
            value: value as TileValue,
          });
        }
      }
    });

    // Create wind tiles (4 of each)
    const winds: WindValue[] = ['east', 'south', 'west', 'north'];
    winds.forEach(wind => {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({
          id: `wind-${wind}-${idCounter++}`,
          suit: 'wind',
          value: wind,
        });
      }
    });

    // Create dragon tiles (4 of each)
    const dragons: DragonValue[] = ['red', 'green', 'white'];
    dragons.forEach(dragon => {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({
          id: `dragon-${dragon}-${idCounter++}`,
          suit: 'dragon',
          value: dragon,
        });
      }
    });

    // Shuffle the deck
    return tiles.sort(() => Math.random() - 0.5);
  };

  const compareTiles = (a: Tile, b: Tile): number => {
    const suitOrder = { bamboo: 0, character: 1, dot: 2, wind: 3, dragon: 4, flower: 5 };
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    if (typeof a.value === 'number' && typeof b.value === 'number') {
      return a.value - b.value;
    }
    return String(a.value).localeCompare(String(b.value));
  };

  const checkWin = (hand: Tile[]): boolean => {
    // Simplified win condition: 4 sets of 3 + 1 pair
    if (hand.length !== 14) return false;

    // Check for pairs
    const tileCounts = new Map<string, number>();
    hand.forEach(tile => {
      const key = `${tile.suit}-${tile.value}`;
      tileCounts.set(key, (tileCounts.get(key) || 0) + 1);
    });

    // Simple check: at least 4 pairs or triplets
    let pairs = 0;
    let triplets = 0;
    tileCounts.forEach(count => {
      if (count >= 2) pairs++;
      if (count >= 3) triplets++;
    });

    return triplets >= 3 || pairs >= 5;
  };

  const findIsolatedTiles = (hand: Tile[]): Tile[] => {
    const isolated: Tile[] = [];
    
    hand.forEach((tile, index) => {
      const hasNeighbor = hand.some((other, otherIndex) => {
        if (index === otherIndex) return false;
        if (tile.suit !== other.suit) return false;
        if (typeof tile.value === 'number' && typeof other.value === 'number') {
          return Math.abs(tile.value - other.value) <= 2;
        }
        return tile.value === other.value;
      });
      
      if (!hasNeighbor) {
        isolated.push(tile);
      }
    });
    
    return isolated;
  };

  const findStrategicDiscard = (hand: Tile[]): Tile | null => {
    // Find tiles that are least useful for forming sets
    const tileCounts = new Map<string, number>();
    
    hand.forEach(tile => {
      const key = `${tile.suit}-${tile.value}`;
      tileCounts.set(key, (tileCounts.get(key) || 0) + 1);
    });

    // Prefer discarding single tiles that are far from others
    const isolated = findIsolatedTiles(hand);
    if (isolated.length > 0) {
      return isolated[0];
    }

    // Otherwise discard a random tile
    return hand[Math.floor(Math.random() * hand.length)];
  };

  const selectTileToDiscard = useCallback((hand: Tile[], difficulty: Difficulty): Tile | null => {
    if (hand.length === 0) return null;

    switch (difficulty) {
      case 'easy':
        // Easy: Random discard
        return hand[Math.floor(Math.random() * hand.length)];
      
      case 'medium':
        // Medium: Discard tiles that don't form pairs or sequences
        const isolatedTiles = findIsolatedTiles(hand);
        if (isolatedTiles.length > 0) {
          return isolatedTiles[Math.floor(Math.random() * isolatedTiles.length)];
        }
        return hand[Math.floor(Math.random() * hand.length)];
      
      case 'hard':
        // Hard: Strategic discard to maximize winning potential
        const strategicTile = findStrategicDiscard(hand);
        return strategicTile || hand[Math.floor(Math.random() * hand.length)];
      
      default:
        return hand[0];
    }
  }, []);

  const drawTile = useCallback((playerIndex: number) => {
    setDrawPile(prevDrawPile => {
      if (prevDrawPile.length === 0) {
        Alert.alert('Game Over', 'No more tiles to draw. Game ends in a draw.');
        setGameState('finished');
        return prevDrawPile;
      }

      const newDrawPile = [...prevDrawPile];
      const drawnTile = newDrawPile.shift()!;

      setPlayers(prevPlayers => {
        const newPlayers = [...prevPlayers];
        newPlayers[playerIndex].hand.push(drawnTile);
        newPlayers[playerIndex].hand.sort((a, b) => compareTiles(a, b));
        
        console.log(`${newPlayers[playerIndex].name} drew a tile`);

        // Check for win
        if (checkWin(newPlayers[playerIndex].hand)) {
          setWinner(newPlayers[playerIndex].name);
          setGameState('finished');
          Alert.alert('Winner!', `${newPlayers[playerIndex].name} wins!`);
        }

        return newPlayers;
      });

      setLastDrawnTile(drawnTile);
      return newDrawPile;
    });
  }, []);

  const discardTile = useCallback((playerIndex: number, tileId: string) => {
    setPlayers(prevPlayers => {
      const newPlayers = [...prevPlayers];
      const player = newPlayers[playerIndex];
      const tileIndex = player.hand.findIndex(t => t.id === tileId);
      
      if (tileIndex === -1) return prevPlayers;

      const [discardedTile] = player.hand.splice(tileIndex, 1);
      player.discarded.push(discardedTile);
      
      console.log(`${player.name} discarded a tile`);

      setSelectedTile(null);
      setLastDrawnTile(null);

      // Move to next player
      const nextPlayerIndex = (playerIndex + 1) % newPlayers.length;
      setCurrentPlayerIndex(nextPlayerIndex);

      // Next player draws
      setTimeout(() => {
        drawTile(nextPlayerIndex);
      }, 500);

      return newPlayers;
    });
  }, [drawTile]);

  const performAITurn = useCallback(() => {
    setPlayers(prevPlayers => {
      const player = prevPlayers[currentPlayerIndex];
      if (!player || !player.isAI) return prevPlayers;

      // AI discards a tile based on difficulty
      const tileToDiscard = selectTileToDiscard(player.hand, difficulty);
      if (tileToDiscard) {
        discardTile(currentPlayerIndex, tileToDiscard.id);
      }

      return prevPlayers;
    });
  }, [currentPlayerIndex, difficulty, selectTileToDiscard, discardTile]);

  const initializeGame = useCallback(() => {
    console.log('Initializing Mahjong game with difficulty:', difficulty);
    const deck = createTileDeck();
    
    // Deal 13 tiles to each player
    const newPlayers: Player[] = [
      {
        id: 'player',
        name: 'You',
        hand: deck.slice(0, 13).sort((a, b) => compareTiles(a, b)),
        discarded: [],
        isAI: false,
      },
      {
        id: 'ai1',
        name: 'AI Bot 1',
        hand: deck.slice(13, 26).sort((a, b) => compareTiles(a, b)),
        discarded: [],
        isAI: true,
      },
      {
        id: 'ai2',
        name: 'AI Bot 2',
        hand: deck.slice(26, 39).sort((a, b) => compareTiles(a, b)),
        discarded: [],
        isAI: true,
      },
      {
        id: 'ai3',
        name: 'AI Bot 3',
        hand: deck.slice(39, 52).sort((a, b) => compareTiles(a, b)),
        discarded: [],
        isAI: true,
      },
    ];

    setPlayers(newPlayers);
    setDrawPile(deck.slice(52));
    setGameState('playing');
    setCurrentPlayerIndex(0);
    setWinner(null);
  }, [difficulty]);

  // Initialize game
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // AI turn logic
  useEffect(() => {
    if (gameState === 'playing' && players[currentPlayerIndex]?.isAI) {
      const timer = setTimeout(() => {
        performAITurn();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayerIndex, gameState, players, performAITurn]);

  const handleTilePress = (tileId: string) => {
    if (gameState !== 'playing') return;
    if (players[currentPlayerIndex]?.isAI) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (selectedTile === tileId) {
      setSelectedTile(null);
    } else {
      setSelectedTile(tileId);
    }
  };

  const handleDiscard = () => {
    if (!selectedTile) {
      Alert.alert('No Tile Selected', 'Please select a tile to discard');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    discardTile(currentPlayerIndex, selectedTile);
  };

  const getTileDisplay = (tile: Tile): string => {
    if (tile.suit === 'bamboo') return `🎋${tile.value}`;
    if (tile.suit === 'character') return `🀄${tile.value}`;
    if (tile.suit === 'dot') return `⚫${tile.value}`;
    if (tile.suit === 'wind') {
      const windEmoji = { east: '🧭E', south: '🧭S', west: '🧭W', north: '🧭N' };
      return windEmoji[tile.value as WindValue];
    }
    if (tile.suit === 'dragon') {
      const dragonEmoji = { red: '🐉R', green: '🐉G', white: '🐉W' };
      return dragonEmoji[tile.value as DragonValue];
    }
    return '🀫';
  };

  const getTileColor = (tile: Tile): string => {
    if (tile.suit === 'bamboo') return '#4CAF50';
    if (tile.suit === 'character') return '#2196F3';
    if (tile.suit === 'dot') return '#FF9800';
    if (tile.suit === 'wind') return '#9C27B0';
    if (tile.suit === 'dragon') return '#F44336';
    return '#757575';
  };

  const renderTile = (tile: Tile, index: number, isPlayerHand: boolean = false) => {
    const isSelected = selectedTile === tile.id;

    return (
      <AnimatedTile
        key={tile.id}
        tile={tile}
        isSelected={isSelected}
        isPlayerHand={isPlayerHand}
        tileColor={getTileColor(tile)}
        tileDisplay={getTileDisplay(tile)}
        onPress={() => isPlayerHand && handleTilePress(tile.id)}
        themeColors={theme.colors}
      />
    );
  };

  const renderPlayer = (player: Player, index: number) => {
    const isCurrentPlayer = index === currentPlayerIndex;
    const isHumanPlayer = !player.isAI;

    return (
      <View
        key={player.id}
        style={[
          styles.playerContainer,
          isCurrentPlayer && styles.currentPlayerContainer,
        ]}
      >
        <View style={styles.playerHeader}>
          <Text style={[styles.playerName, { color: theme.colors.text }]}>
            {player.name}
            {isCurrentPlayer && ' 🎯'}
          </Text>
          <Text style={[styles.tileCount, { color: theme.dark ? '#98989D' : '#666' }]}>
            {player.hand.length} tiles
          </Text>
        </View>

        {isHumanPlayer ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handContainer}
          >
            {player.hand.map((tile, idx) => renderTile(tile, idx, true))}
          </ScrollView>
        ) : (
          <View style={styles.aiHandContainer}>
            {player.hand.map((_, idx) => (
              <View key={idx} style={[styles.tile, styles.hiddenTile]}>
                <Text style={styles.tileText}>🀫</Text>
              </View>
            ))}
          </View>
        )}

        {player.discarded.length > 0 && (
          <View style={styles.discardedContainer}>
            <Text style={[styles.discardedLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
              Discarded:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.discardedTiles}
            >
              {player.discarded.slice(-5).map((tile, idx) => (
                <View
                  key={tile.id}
                  style={[styles.discardedTile, { backgroundColor: getTileColor(tile) }]}
                >
                  <Text style={styles.discardedTileText}>{getTileDisplay(tile)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  if (gameState === 'setup') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Setting up game...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Mahjong - {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
        </Text>
        <Pressable onPress={initializeGame} style={styles.resetButton}>
          <IconSymbol name="arrow.clockwise" size={24} color={theme.colors.primary} />
        </Pressable>
      </View>

      {gameState === 'finished' && winner && (
        <View style={[styles.winnerBanner, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.winnerText}>🎉 {winner} wins! 🎉</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gameInfo}>
          <Text style={[styles.gameInfoText, { color: theme.dark ? '#98989D' : '#666' }]}>
            Tiles remaining: {drawPile.length}
          </Text>
        </View>

        {players.map((player, index) => renderPlayer(player, index))}
      </ScrollView>

      {!players[currentPlayerIndex]?.isAI && gameState === 'playing' && (
        <View style={[styles.actionBar, { backgroundColor: theme.colors.card }]}>
          <Pressable
            style={[
              styles.discardButton,
              { backgroundColor: selectedTile ? theme.colors.primary : theme.dark ? '#333' : '#ccc' },
            ]}
            onPress={handleDiscard}
            disabled={!selectedTile}
          >
            <Text style={[styles.discardButtonText, { color: selectedTile ? '#fff' : '#999' }]}>
              Discard Selected Tile
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  resetButton: {
    padding: 8,
  },
  winnerBanner: {
    padding: 16,
    alignItems: 'center',
  },
  winnerText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gameInfo: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  gameInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  playerContainer: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  currentPlayerContainer: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  tileCount: {
    fontSize: 14,
  },
  handContainer: {
    paddingVertical: 8,
  },
  aiHandContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 8,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 1.3,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 6,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  hiddenTile: {
    backgroundColor: '#757575',
  },
  tileText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  discardedContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  discardedLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  discardedTiles: {
    flexDirection: 'row',
  },
  discardedTile: {
    width: TILE_SIZE * 0.7,
    height: TILE_SIZE * 0.9,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    opacity: 0.7,
  },
  discardedTileText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  discardButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  discardButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
