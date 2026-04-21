import { Link } from "react-router-dom";

function UpcomingArtistsPage() {
    return (
        <main className="upcoming-page">
            <Link className="back-link" to="/dashboard">
                Back to home
            </Link>
            <p className="eyebrow">Artists</p>
            <h1>Upcoming artists</h1>
            <p className="subtitle">
                A dedicated discovery page for emerging artists will live here.
            </p>

            <section className="empty-state-panel">
                <p>
                    Artist discovery, profiles, and follow actions are next on the
                    roadmap.
                </p>
            </section>
        </main>
    );
}

export default UpcomingArtistsPage;
