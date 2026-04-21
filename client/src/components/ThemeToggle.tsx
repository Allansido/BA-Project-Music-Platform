interface ThemeToggleProps {
    theme: "light" | "dark";
    onToggleTheme: () => void;
}

function ThemeToggle({ theme, onToggleTheme }: ThemeToggleProps) {
    const isDark = theme === "dark";

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
            <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
            {isDark ? "Light" : "Dark"}
        </button>
    );
}

export default ThemeToggle;
