import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/**/*.{ts,tsx}",
        // Consuming apps should add their own content paths
    ],
    theme: {
        extend: {
            colors: {
                /** Elder-Guard brand palette */
                brand: {
                    50: "#f0f9ff",
                    100: "#e0f2fe",
                    200: "#bae6fd",
                    300: "#7dd3fc",
                    400: "#38bdf8",
                    500: "#0ea5e9",
                    600: "#0284c7",
                    700: "#0369a1",
                    800: "#075985",
                    900: "#0c4a6e",
                    950: "#082f49",
                },
                /** Status colors for alerts */
                status: {
                    low: "#22c55e",
                    medium: "#eab308",
                    high: "#f97316",
                    critical: "#ef4444",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
        },
    },
    plugins: [],
};

export default config;
