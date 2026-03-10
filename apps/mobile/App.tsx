import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Elder-Guard AI</Text>
            <Text style={styles.subtitle}>Mobile Sensor App — Week 1 Scaffold</Text>
            <StatusBar style="auto" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f0f9ff",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#0c4a6e",
    },
    subtitle: {
        fontSize: 16,
        color: "#075985",
        marginTop: 8,
    },
});
