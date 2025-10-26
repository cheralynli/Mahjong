
import React from "react";
import { Stack, router } from "expo-router";
import { StyleSheet, View, Text, Platform } from "react-native";
import { useTheme } from "@react-navigation/native";
import Button from "@/components/button";

export default function HomeScreen() {
  const theme = useTheme();

  const handleDifficultySelect = (difficulty: 'easy' | 'medium' | 'hard') => {
    console.log('Selected difficulty:', difficulty);
    router.push({
      pathname: '/mahjong',
      params: { difficulty },
    });
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: "Mahjong Game",
          }}
        />
      )}
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              🀄 Mahjong
            </Text>
            <Text style={[styles.subtitle, { color: theme.dark ? '#98989D' : '#666' }]}>
              Play against AI opponents
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Select Difficulty
            </Text>
            
            <Button
              onPress={() => handleDifficultySelect('easy')}
              variant="filled"
              size="lg"
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
            >
              🌱 Easy
            </Button>

            <Button
              onPress={() => handleDifficultySelect('medium')}
              variant="filled"
              size="lg"
              style={[styles.button, { backgroundColor: '#FF9800' }]}
            >
              ⚡ Medium
            </Button>

            <Button
              onPress={() => handleDifficultySelect('hard')}
              variant="filled"
              size="lg"
              style={[styles.button, { backgroundColor: '#F44336' }]}
            >
              🔥 Hard
            </Button>
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
              How to Play
            </Text>
            <Text style={[styles.infoText, { color: theme.dark ? '#98989D' : '#666' }]}>
              - Draw and discard tiles to form winning combinations
            </Text>
            <Text style={[styles.infoText, { color: theme.dark ? '#98989D' : '#666' }]}>
              - Create sets of 3 matching or sequential tiles
            </Text>
            <Text style={[styles.infoText, { color: theme.dark ? '#98989D' : '#666' }]}>
              - Win by completing 4 sets plus 1 pair
            </Text>
            <Text style={[styles.infoText, { color: theme.dark ? '#98989D' : '#666' }]}>
              - Tap a tile to select it, then tap &apos;Discard&apos;
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginBottom: 16,
  },
  infoSection: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
});
