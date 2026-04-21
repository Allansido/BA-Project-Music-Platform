interface MusicLogoProps {
    className?: string;
}

function MusicLogo({ className = "" }: MusicLogoProps) {
    return (
        <div className={`music-logo ${className}`} role="img" aria-label="Music note logo">
            <span aria-hidden="true">&#9835;</span>
        </div>
    );
}

export default MusicLogo;
