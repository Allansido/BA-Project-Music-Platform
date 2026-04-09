interface GenreSelectorProps {
    genres: string[];
    selectedGenres: string[];
    onToggleGenre: (genre: string) => void;
    error?: string;
}

function GenreSelector({
    genres,
    selectedGenres,
    onToggleGenre,
    error
}: GenreSelectorProps) {
    return (
        <div className="form-group">
            <label className="form-label">Preferred genres</label>
            <p className="helper-text">
                Choose at least 3 genres. You can choose more if you want.
            </p>

            <div className="genre-grid">
                {genres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);

                    return (
                        <button
                            key={genre}
                            type="button"
                            className={`genre-chip ${isSelected ? "selected" : ""}`}
                            onClick={() => onToggleGenre(genre)}
                        >
                            {genre}
                        </button>
                    );
                })}
            </div>

            {error ? <p className="error-text">{error}</p> : null}
        </div>
    );
}

export default GenreSelector;