// The palettes below carry the DEFAULT accent ("Ember"). The user-selectable
// accent themes further down overwrite the accent slice of both palettes via
// applyAccentTheme() — everything else (surfaces, text, status colors) stays.
export const Colors = {

    dark: {
        primary: "#F7742E",
        // Accent for text and icons. On dark surfaces the accent itself is
        // legible; on light ones it is not, so the light palette darkens it.
        primaryText: "#F7742E",
        primaryLight: "rgb(237, 178, 146)",
        primaryDark: "rgb(190, 74, 11)",
        ink: "#14100C",
        inkOnSecondary: "#0C1410",
        secondary: "#4ED39A",
        secondaryLight: "rgb(178, 214, 200)",
        secondaryDark: "rgb(24, 160, 108)",
        fields: "rgba(247, 116, 46, 0.08)",
        record: "#4BA3DB",
        recordLight: "rgb(51, 139, 255)",
        recordDark: "rgb(2, 49, 111)",
        danger: "#E85C4A",
        dangerDark: "rgb(168, 55, 41)",
        planned: "#F2C14E",
        plannedDark: "rgb(201, 174, 0)",

        text: "#A4A8B3",
        textStrong: "#ECEDF1",
        textDisabled: "#3A3D46",
        textInverted: "#14100C",
        quietText: "#868C99",
        title: "#F2F3F5",

        background: "#0A0B0F",
        cardBackground: "#14161C",
        cardBorder: "rgba(255, 255, 255, 0.07)",
        navBackground: "#0D0E13",
        uiBackground: "#0F1116",
        border: "rgba(255, 255, 255, 0.08)",
        hairline: "rgba(255, 255, 255, 0.06)",
        chipBackground: "rgba(255, 255, 255, 0.06)",
        navHandle: "rgba(255, 255, 255, 0.22)",

        // Data tables: the set lists build a surface, gridlines and alternating
        // rows out of these instead of a scheme ternary per component.
        tableSurface: "rgba(16, 17, 24, 0.58)",
        tableGridline: "rgba(255, 255, 255, 0.07)",
        tableRowSurface: "rgba(24, 25, 34, 0.9)",
        tableRowAltSurface: "rgba(255, 255, 255, 0.045)",
        recordSurface: "rgba(55, 63, 174, 0.38)",

        // Neutral overlays for stacked surfaces, strongest first.
        overlayStrong: "rgba(255, 255, 255, 0.14)",
        overlayMedium: "rgba(255, 255, 255, 0.10)",
        overlaySoft: "rgba(255, 255, 255, 0.07)",

        // Fixed in both schemes: a scrim darkens whatever sits under it, and
        // white is the only legible ink on the danger fill.
        onDanger: "#FFFFFF",
        scrim: "rgba(0, 0, 0, 0.5)",
        scrimSoft: "rgba(0, 0, 0, 0.04)",
        // Barely a tint - a tap-catcher behind a popover, not a dimmer.
        scrimSoft: "rgba(0, 0, 0, 0.04)",
        sheetScrim: "rgba(0, 0, 0, 0.62)",

        iconColor: "#868C99",
        iconColorFocused: "#F7742E",
    },

    light: {
        primary: "#F7742E",
        primaryText: "#B4470B",
        primaryLight: "rgb(237, 178, 146)",
        primaryDark: "rgb(190, 74, 11)",
        ink: "#14100C",
        inkOnSecondary: "#0C1410",
        secondary: "#1E9E6A",
        secondaryLight: "rgb(178, 214, 200)",
        secondaryDark: "rgb(24, 160, 108)",
        fields: "rgba(247, 116, 46, 0.08)",
        record: "#2C7FBF",
        recordLight: "rgb(218, 221, 255)",
        recordDark: "rgb(19, 27, 126)",
        danger: "#D64533",
        dangerDark: "rgb(150, 40, 26)",
        planned: "#C08A12",
        plannedDark: "rgb(201, 174, 0)",

        text: "#5C6270",
        textStrong: "#22252C",
        textDisabled: "#C9CDD5",
        textInverted: "#14100C",
        quietText: "#676B76",
        title: "#16191F",

        background: "#F4F5F7",
        cardBackground: "#FFFFFF",
        cardBorder: "rgba(15, 17, 22, 0.07)",
        navBackground: "#F7F8FA",
        uiBackground: "#F1F2F5",
        border: "rgba(15, 17, 22, 0.08)",
        hairline: "rgba(15, 17, 22, 0.06)",
        chipBackground: "rgba(15, 17, 22, 0.06)",
        navHandle: "rgba(15, 17, 22, 0.22)",

        tableSurface: "#f5f4fa",
        tableGridline: "rgba(32, 30, 43, 0.12)",
        tableRowSurface: "rgba(255, 255, 255, 0.86)",
        tableRowAltSurface: "rgba(32, 30, 43, 0.08)",
        recordSurface: "rgba(55, 63, 174, 0.16)",

        overlayStrong: "rgba(15, 17, 22, 0.14)",
        overlayMedium: "rgba(15, 17, 22, 0.10)",
        overlaySoft: "rgba(15, 17, 22, 0.07)",

        onDanger: "#FFFFFF",
        scrim: "rgba(0, 0, 0, 0.5)",
        sheetScrim: "rgba(0, 0, 0, 0.62)",

        iconColor: "#676B76",
        iconColorFocused: "#F7742E",
    }
}

// User-selectable accent themes. Each entry defines the accent slice of BOTH
// palettes: primary (per scheme, so dark uses the on-dark variant and light a
// readable on-light variant), ink on primary, secondary (per scheme), derived
// tints and the status/accent aliases that track primary/secondary.
export const AccentThemes = {
    ember: {
        name: "Ember",
        swatch: { primary: "#F7742E", secondary: "#4ED39A" },
        dark: {
            primary: "#F7742E",
            primaryText: "#F7742E",
            primaryLight: "rgb(237, 178, 146)",
            primaryDark: "rgb(190, 74, 11)",
            ink: "#14100C",
            textInverted: "#14100C",
            inkOnSecondary: "#0C1410",
            secondary: "#4ED39A",
            secondaryLight: "rgb(178, 214, 200)",
            secondaryDark: "rgb(24, 160, 108)",
            fields: "rgba(247, 116, 46, 0.08)",
            iconColorFocused: "#F7742E",
        },
        light: {
            primary: "#F7742E",
            primaryText: "#B4470B",
            primaryLight: "rgb(237, 178, 146)",
            primaryDark: "rgb(190, 74, 11)",
            ink: "#14100C",
            textInverted: "#14100C",
            inkOnSecondary: "#0C1410",
            secondary: "#1E9E6A",
            secondaryLight: "rgb(178, 214, 200)",
            secondaryDark: "rgb(24, 160, 108)",
            fields: "rgba(247, 116, 46, 0.08)",
            iconColorFocused: "#F7742E",
        },
    },

    volt: {
        name: "Volt",
        swatch: { primary: "#C8F04A", secondary: "#7C86FF" },
        dark: {
            primary: "#C8F04A",
            primaryText: "#C8F04A",
            primaryLight: "rgb(222, 246, 146)",
            primaryDark: "rgb(140, 168, 52)",
            ink: "#12160A",
            textInverted: "#12160A",
            inkOnSecondary: "#0E1026",
            secondary: "#7C86FF",
            secondaryLight: "rgb(176, 182, 255)",
            secondaryDark: "rgb(87, 94, 179)",
            fields: "rgba(200, 240, 74, 0.08)",
            iconColorFocused: "#C8F04A",
        },
        light: {
            primary: "#6E8F12",
            primaryText: "#5A7510",
            primaryLight: "rgb(222, 246, 146)",
            primaryDark: "rgb(140, 168, 52)",
            ink: "#12160A",
            textInverted: "#12160A",
            inkOnSecondary: "#0E1026",
            secondary: "#5B6AE8",
            secondaryLight: "rgb(176, 182, 255)",
            secondaryDark: "rgb(87, 94, 179)",
            fields: "rgba(110, 143, 18, 0.08)",
            iconColorFocused: "#6E8F12",
        },
    },

    ultraviolet: {
        name: "Ultraviolet",
        swatch: { primary: "#6E5CF0", secondary: "#FFC24B" },
        dark: {
            primary: "#8B7CF5",
            primaryText: "#8B7CF5",
            primaryLight: "rgb(168, 157, 246)",
            primaryDark: "rgb(77, 64, 168)",
            ink: "#F5F4FF",
            textInverted: "#F5F4FF",
            inkOnSecondary: "#2A1F04",
            secondary: "#FFC24B",
            secondaryLight: "rgb(255, 218, 147)",
            secondaryDark: "rgb(179, 136, 53)",
            fields: "rgba(139, 124, 245, 0.08)",
            iconColorFocused: "#8B7CF5",
        },
        light: {
            primary: "#6E5CF0",
            primaryText: "#5A48D6",
            primaryLight: "rgb(168, 157, 246)",
            primaryDark: "rgb(77, 64, 168)",
            ink: "#F5F4FF",
            textInverted: "#F5F4FF",
            inkOnSecondary: "#2A1F04",
            secondary: "#D99A16",
            secondaryLight: "rgb(255, 218, 147)",
            secondaryDark: "rgb(179, 136, 53)",
            fields: "rgba(110, 92, 240, 0.08)",
            iconColorFocused: "#6E5CF0",
        },
    },

    coral: {
        name: "Coral",
        swatch: { primary: "#FF5D5D", secondary: "#22D3C0" },
        dark: {
            primary: "#FF7A7A",
            primaryText: "#FF7A7A",
            primaryLight: "rgb(255, 158, 158)",
            primaryDark: "rgb(179, 65, 65)",
            ink: "#2A0C0C",
            textInverted: "#2A0C0C",
            inkOnSecondary: "#062C28",
            secondary: "#22D3C0",
            secondaryLight: "rgb(122, 229, 217)",
            secondaryDark: "rgb(24, 148, 134)",
            fields: "rgba(255, 122, 122, 0.08)",
            iconColorFocused: "#FF7A7A",
        },
        light: {
            primary: "#E23B3B",
            primaryText: "#C22C2C",
            primaryLight: "rgb(255, 158, 158)",
            primaryDark: "rgb(179, 65, 65)",
            ink: "#2A0C0C",
            textInverted: "#2A0C0C",
            inkOnSecondary: "#062C28",
            secondary: "#12A697",
            secondaryLight: "rgb(122, 229, 217)",
            secondaryDark: "rgb(24, 148, 134)",
            fields: "rgba(226, 59, 59, 0.08)",
            iconColorFocused: "#E23B3B",
        },
    },
}

export const DEFAULT_ACCENT_THEME = "ember";

// Overwrites the accent slice of both palettes in place. Existing consumers
// read Colors[scheme] on every render, so a re-render after this call is all
// that is needed for the new accent to take effect everywhere.
export function applyAccentTheme(accentKey) {
    const accent = AccentThemes[accentKey] ?? AccentThemes[DEFAULT_ACCENT_THEME];

    Object.assign(Colors.dark, accent.dark);
    Object.assign(Colors.light, accent.light);
}

// "#RRGGBB" (or "#RGB"/"#RRGGBBAA") -> "rgba(r, g, b, alpha)". Non-hex values
// pass through untouched so callers can feed it any theme token safely.
export function withAlpha(color, alpha) {
    if (typeof color !== "string" || !color.startsWith("#")) {
        return color;
    }

    let hex = color.slice(1);

    if (hex.length === 3) {
        hex = hex
            .split("")
            .map((char) => char + char)
            .join("");
    }

    if (hex.length === 8) {
        hex = hex.slice(0, 6);
    }

    if (hex.length !== 6) {
        return color;
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
