import type { OnboardingArtist } from "../types/auth";

interface ArtistSelectorProps {
    artists: OnboardingArtist[];
    selectedArtists: string[];
    searchTerm: string;
    onSearchTermChange: (searchTerm: string) => void;
    onToggleArtist: (artistName: string) => void;
    error?: string;
}

function ArtistSelector({
    artists,
    selectedArtists,
    searchTerm,
    onSearchTermChange,
    onToggleArtist,
    error
}: ArtistSelectorProps) {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const visibleArtists = artists
        .filter((artist) =>
            artist.name.toLowerCase().includes(normalizedSearchTerm)
        )
        .slice(0, 36);

    return (
        <div className="choice-section">
            <div className="choice-section-heading">
                <label className="form-label" htmlFor="artist-search">
                    Artists you already like
                </label>
                <span>{selectedArtists.length} selected</span>
            </div>
            <p className="helper-text">
                Pick at least 3 artists from the Last.fm listening data.
            </p>

            <input
                id="artist-search"
                type="search"
                className="form-input"
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder="Search artists"
            />

            <div className="artist-grid">
                {visibleArtists.map((artist) => {
                    const isSelected = selectedArtists.includes(artist.name);

                    return (
                        <button
                            key={artist.id}
                            type="button"
                            className={`artist-tile ${isSelected ? "selected" : ""}`}
                            onClick={() => onToggleArtist(artist.name)}
                            aria-pressed={isSelected}
                        >
                            <span className="artist-avatar" aria-hidden="true">
                                {artist.name.charAt(0).toUpperCase()}
                            </span>
                            <span>
                                <strong>{artist.name}</strong>
                                <small>
                                    {artist.listenerCount} listeners / {artist.segment}
                                </small>
                            </span>
                        </button>
                    );
                })}
            </div>

            {visibleArtists.length === 0 ? (
                <p className="empty-site-text">No artists match that search.</p>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
        </div>
    );
}

export default ArtistSelector;
